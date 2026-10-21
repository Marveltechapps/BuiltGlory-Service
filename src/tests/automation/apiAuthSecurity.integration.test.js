import { jest } from "@jest/globals";
import jwt from "jsonwebtoken";
import request from "supertest";
import { env } from "../../config/env.js";
import { blacklistAccessToken } from "../../middleware/auth.js";
import { app, bearer, seedAdmin, seedCustomer, seedProperty, setupIntegrationDb } from "../helpers/integrationHarness.js";

jest.setTimeout(60_000);
setupIntegrationDb();

const percentile = (samples, p) => {
  const sorted = [...samples].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
};

const timed = async (run) => {
  const started = performance.now();
  const response = await run();
  return { response, elapsed: performance.now() - started };
};

describe("API contract", () => {
  test("operational routes and the OpenAPI document are available", async () => {
    const health = await request(app).get("/health").set("x-request-id", "automation-health");
    expect(health.status).toBe(200);
    expect(health.body.status).toBe("ok");
    expect(health.headers["x-request-id"] || health.body.uptimeSeconds).toBeTruthy();

    const ready = await request(app).get("/ready");
    expect(ready.status).toBe(200);
    expect(ready.body.checks.api).toBe("ok");

    const metrics = await request(app).get("/metrics");
    expect(metrics.status).toBe(200);
    expect(metrics.body).toEqual(expect.objectContaining({ uptimeSeconds: expect.any(Number) }));

    const spec = await request(app).get("/openapi.json");
    expect(spec.status).toBe(200);
    expect(spec.body.openapi).toBe("3.1.0");
    expect(spec.body.paths["/health"] || spec.body.paths["/api/v1/properties"] || spec.body.paths).toBeTruthy();
  });

  test("unknown routes and invalid bodies use the error envelope", async () => {
    const missing = await request(app).get("/api/v1/not-a-route").set("x-request-id", "automation-404");
    expect(missing.status).toBe(404);
    expect(missing.body.error).toEqual(expect.objectContaining({ code: "NOT_FOUND", message: "Route not found." }));
    expect(missing.body.meta.requestId).toBeTruthy();
    expect(JSON.stringify(missing.body)).not.toMatch(/\.js:\d+/);

    const invalid = await request(app).post("/api/v1/auth/admin/login").set("content-type", "application/json").send("{");
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe("VALIDATION_ERROR");
    expect(invalid.body.meta.requestId).toBeTruthy();

    const validation = await request(app).post("/api/v1/auth/customer/otp/send").send({ phone: "12" });
    expect(validation.status).toBe(400);
    expect(validation.body.error.code).toBe("VALIDATION_ERROR");
    expect(Array.isArray(validation.body.error.details)).toBe(true);
    expect(validation.body.error.details.length).toBeGreaterThan(0);
  });
});

describe("authentication and authorization", () => {
  test("admin login issues a bearer session and rejects bad credentials", async () => {
    const email = `automation-${Date.now()}@example.com`;
    await seedAdmin({ email, password: "Password123!" });

    const success = await request(app).post("/api/v1/auth/admin/login").send({ email, password: "Password123!" });
    expect(success.status).toBe(200);
    expect(success.body.data.accessToken).toEqual(expect.any(String));
    expect(success.body.data.refreshToken).toEqual(expect.any(String));
    expect(JSON.stringify(success.body)).not.toMatch(/passwordHash/i);

    const wrong = await request(app).post("/api/v1/auth/admin/login").send({ email, password: "WrongPassword1" });
    expect(wrong.status).toBe(401);
    expect(wrong.body.error.code).toBe("UNAUTHORIZED");

    const inactiveEmail = `inactive-${Date.now()}@example.com`;
    await seedAdmin({ email: inactiveEmail, password: "Password123!", isActive: false });
    const inactive = await request(app).post("/api/v1/auth/admin/login").send({ email: inactiveEmail, password: "Password123!" });
    expect(inactive.status).toBe(401);
  });

  test("tokens are checked for signature, type, account state, revocation, and permission", async () => {
    const open = await request(app).get("/api/v1/me");
    expect(open.status).toBe(401);
    expect(open.body.error.code).toBe("UNAUTHORIZED");

    const forged = jwt.sign({ sub: "507f1f77bcf86cd799439011", type: "admin", role: "super_admin" }, "wrong-secret-wrong-secret-wrong", {
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE
    });
    const badSignature = await request(app).get("/api/v1/admin/properties").set("Authorization", bearer(forged));
    expect(badSignature.status).toBe(401);

    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({ sub: "507f1f77bcf86cd799439011", type: "admin", iss: env.JWT_ISSUER, aud: env.JWT_AUDIENCE })).toString("base64url");
    const unsigned = await request(app).get("/api/v1/admin/properties").set("Authorization", bearer(`${header}.${payload}.`));
    expect(unsigned.status).toBe(401);

    const customer = await seedCustomer();
    const wrongType = await request(app).get("/api/v1/admin/properties").set("Authorization", bearer(customer.token));
    expect(wrongType.status).toBe(401);

    const blocked = await seedCustomer({ isBlocked: true });
    const blockedProfile = await request(app).get("/api/v1/me").set("Authorization", bearer(blocked.token));
    expect(blockedProfile.status).toBe(401);
    expect(blockedProfile.body.error.message).toMatch(/unavailable/i);

    const inactiveAdmin = await seedAdmin({ isActive: false, role: "admin", permissions: ["properties.read"] });
    const inactiveCall = await request(app).get("/api/v1/admin/properties").set("Authorization", bearer(inactiveAdmin.token));
    expect(inactiveCall.status).toBe(401);

    const limited = await seedAdmin({ role: "support", permissions: ["support.read"] });
    const denied = await request(app).get("/api/v1/admin/properties").set("Authorization", bearer(limited.token));
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe("FORBIDDEN");

    const wildcard = await seedAdmin({ role: "operations", permissions: ["*"] });
    const allowed = await request(app).get("/api/v1/admin/properties").set("Authorization", bearer(wildcard.token));
    expect(allowed.status).toBe(200);

    const revokedAdmin = await seedAdmin();
    await blacklistAccessToken(revokedAdmin.token);
    const revoked = await request(app).get("/api/v1/admin/properties").set("Authorization", bearer(revokedAdmin.token));
    expect(revoked.status).toBe(401);
    expect(revoked.body.error.message).toMatch(/revoked/i);
  });
});

describe("security", () => {
  test("responses send browser hardening headers and drop operator injection keys", async () => {
    const health = await request(app).get("/health");
    expect(health.headers["x-content-type-options"]).toBe("nosniff");
    expect(health.headers["x-powered-by"]).toBeUndefined();

    const origin = env.CORS_ORIGINS ? env.CORS_ORIGINS.split(",")[0].trim() : "http://localhost:5173";
    const cors = await request(app).get("/health").set("Origin", origin);
    expect(cors.headers["access-control-allow-origin"]).toBe(origin);
    expect(cors.headers["access-control-allow-credentials"]).toBe("true");

    const injected = await request(app).post("/api/v1/auth/admin/login").send({ email: { $gt: "" }, password: { $ne: null } });
    expect(injected.status).toBe(400);
    expect(injected.body.error.code).toBe("VALIDATION_ERROR");
    expect(JSON.stringify(injected.body)).not.toMatch(/\$gt|\$ne|stack/);
  });
});

describe("integration", () => {
  test("public catalog, customer profile, and admin inventory stay consistent", async () => {
    const visible = await seedProperty({ title: "Automation visible plot", status: "available", isVisibleOnApp: true });
    await seedProperty({ title: "Automation draft plot", status: "draft", isVisibleOnApp: true });
    const customer = await seedCustomer({ name: "Automation Buyer" });
    const admin = await seedAdmin({ permissions: ["properties.read"] });

    const catalog = await request(app).get("/api/v1/properties");
    expect(catalog.status).toBe(200);
    const publicTitles = catalog.body.data.map((row) => row.title);
    expect(publicTitles).toContain("Automation visible plot");
    expect(publicTitles).not.toContain("Automation draft plot");
    expect(catalog.body.meta.total).toBeGreaterThanOrEqual(1);

    const detail = await request(app).get(`/api/v1/properties/${visible._id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.title).toBe("Automation visible plot");

    const profile = await request(app).get("/api/v1/me").set("Authorization", bearer(customer.token));
    expect(profile.status).toBe(200);
    expect(profile.body.data.name).toBe("Automation Buyer");

    const inventory = await request(app).get("/api/v1/admin/properties").set("Authorization", bearer(admin.token));
    expect(inventory.status).toBe(200);
    const adminTitles = inventory.body.data.map((row) => row.title);
    expect(adminTitles).toEqual(expect.arrayContaining(["Automation visible plot", "Automation draft plot"]));
  });
});

describe("performance", () => {
  test("health and property list stay inside the local latency budget", async () => {
    await seedProperty({ title: "Budget plot", status: "available" });
    const healthSamples = [];
    for (let index = 0; index < 20; index += 1) {
      const sample = await timed(() => request(app).get("/health"));
      expect(sample.response.status).toBe(200);
      healthSamples.push(sample.elapsed);
    }
    const listSamples = [];
    for (let index = 0; index < 10; index += 1) {
      const sample = await timed(() => request(app).get("/api/v1/properties"));
      expect(sample.response.status).toBe(200);
      listSamples.push(sample.elapsed);
    }
    expect(percentile(healthSamples, 95)).toBeLessThan(400);
    expect(percentile(listSamples, 95)).toBeLessThan(1000);
  });
});
