import request from "supertest";
import { createApp } from "../app.js";
describe("BuiltGlory API", () => {
  const app = createApp();
  test("serves health", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(typeof res.body.uptimeSeconds).toBe("number");
  });
  test("serves liveness at the API root", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ status: "ok" }));
  });
  test("serves OpenAPI", async () => {
    const res = await request(app).get("/openapi.json");
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe("3.1.0");
  });
  test("validates customer OTP request", async () => {
    const res = await request(app).post("/api/v1/auth/customer/otp/send").send({ phone: "123" });
    expect(res.status).toBe(400);
  });
  test("returns 401 for an unreadable refresh token", async () => {
    const res = await request(app).post("/api/v1/auth/refresh").send({ refreshToken: "not-a-session" });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
    expect(res.body.error.message).toBe("Refresh token revoked or expired.");
  });
});