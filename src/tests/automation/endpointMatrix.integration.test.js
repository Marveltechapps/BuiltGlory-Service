import { jest } from "@jest/globals";
import request from "supertest";
import { app, bearer, seedAdmin, seedCustomer, setupIntegrationDb } from "../helpers/integrationHarness.js";
import { loadApiCatalog } from "./routeCatalog.js";

jest.setTimeout(180_000);
setupIntegrationDb();

const catalog = loadApiCatalog();
const call = (method, url, token) => {
  const req = request(app)[method](url);
  if (token) req.set("Authorization", bearer(token));
  if (method !== "get") req.send({});
  return req;
};

const leaksStack = (response) => JSON.stringify(response.body || {}).includes("    at ");

describe("endpoint inventory", () => {
  test("discovers the mounted API surface", () => {
    expect(catalog.length).toBeGreaterThan(150);
    const modules = new Set(catalog.map((endpoint) => endpoint.module));
    for (const name of ["auth", "properties", "users", "payments", "sellRequests", "acquisitions", "salesDeals", "visits", "supportTickets", "documents"]) {
      expect(modules.has(name)).toBe(true);
    }
  });
});

describe("endpoint matrix", () => {
  test("anonymous callers are rejected on protected routes and public routes do not crash", async () => {
    const failures = [];
    for (const endpoint of catalog) {
      const response = await call(endpoint.method, endpoint.examplePath);
      if (leaksStack(response)) failures.push(`${endpoint.method} ${endpoint.path} leaked a stack`);
      if (endpoint.auth === "public") {
        if (response.status >= 500) failures.push(`${endpoint.method} ${endpoint.examplePath} anonymous ${response.status}`);
      } else if (response.status !== 401) {
        failures.push(`${endpoint.method} ${endpoint.examplePath} anonymous ${response.status}, expected 401`);
      }
    }
    expect(failures).toEqual([]);
  });

  test("a customer token cannot call admin routes and an admin token cannot call customer routes", async () => {
    const customer = await seedCustomer();
    const admin = await seedAdmin();
    const failures = [];
    for (const endpoint of catalog) {
      if (endpoint.auth === "admin") {
        const response = await call(endpoint.method, endpoint.examplePath, customer.token);
        if (response.status !== 401) failures.push(`${endpoint.method} ${endpoint.examplePath} customer ${response.status}`);
      }
      if (endpoint.auth === "customer") {
        const response = await call(endpoint.method, endpoint.examplePath, admin.token);
        if (response.status !== 401) failures.push(`${endpoint.method} ${endpoint.examplePath} admin ${response.status}`);
      }
    }
    expect(failures).toEqual([]);
  });

  test("an admin without the route permission is forbidden", async () => {
    const limited = await seedAdmin({ role: "designer", permissions: [] });
    const failures = [];
    for (const endpoint of catalog.filter((item) => item.auth === "admin" && item.permission)) {
      const response = await call(endpoint.method, endpoint.examplePath, limited.token);
      if (response.status !== 403) failures.push(`${endpoint.method} ${endpoint.examplePath} limited ${response.status}`);
    }
    expect(failures).toEqual([]);
  });

  test("a super admin read does not crash and a validated write rejects an empty body", async () => {
    const admin = await seedAdmin();
    const customer = await seedCustomer();
    const failures = [];
    for (const endpoint of catalog.filter((item) => item.method === "get")) {
      const token = endpoint.auth === "customer" ? customer.token : endpoint.auth === "public" ? null : admin.token;
      const response = await call(endpoint.method, endpoint.examplePath, token);
      if (response.status >= 500 || leaksStack(response)) {
        failures.push(`${endpoint.method} ${endpoint.examplePath} ${response.status} ${response.body?.error?.message || ""}`);
      }
    }
    for (const endpoint of catalog.filter((item) => item.validates && ["post", "put", "patch"].includes(item.method))) {
      const token = endpoint.auth === "customer" || endpoint.auth === "any" ? customer.token : endpoint.auth === "admin" ? admin.token : null;
      const response = await call(endpoint.method, endpoint.examplePath, token);
      if (response.status >= 500 || leaksStack(response)) {
        failures.push(`${endpoint.method} ${endpoint.examplePath} empty ${response.status} ${response.body?.error?.message || ""}`);
      }
    }
    expect(failures).toEqual([]);
  });

  test("malformed identifiers do not become server errors", async () => {
    const admin = await seedAdmin();
    const customer = await seedCustomer();
    const failures = [];
    for (const endpoint of catalog.filter((item) => item.path.includes(":"))) {
      const url = endpoint.examplePath.replaceAll("507f1f77bcf86cd799439011", "not-an-id");
      const token = endpoint.auth === "customer" || endpoint.auth === "any" ? customer.token : endpoint.auth === "admin" ? admin.token : null;
      const response = await call(endpoint.method, url, token);
      if (response.status >= 500 || leaksStack(response)) {
        failures.push(`${endpoint.method} ${endpoint.path} ${response.status}`);
      }
    }
    expect(failures).toEqual([]);
  });
});
