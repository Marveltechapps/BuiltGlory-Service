import request from "supertest";
import { app, setupIntegrationDb, seedProperty } from "./helpers/integrationHarness.js";

setupIntegrationDb();

describe("P0/P1 gap fixes", () => {
  test("GET /public/admin-login-stats is public", async () => {
    const res = await request(app).get("/api/v1/public/admin-login-stats");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(
      expect.objectContaining({
        properties: expect.any(Number),
        users: expect.any(Number),
        deals: expect.any(Number)
      })
    );
  });

  test("GET /properties/:id returns sold listings that are visible", async () => {
    const sold = await seedProperty({ status: "sold", title: "Sold Gap Fix Villa" });
    const res = await request(app).get(`/api/v1/properties/${sold._id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("sold");
  });
});
