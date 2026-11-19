import request from "supertest";
import { app, bearer, seedAdmin, seedProperty, setupIntegrationDb } from "./helpers/integrationHarness.js";

setupIntegrationDb();

describe("locations and boost-orders admin APIs", () => {
  test("creates and lists locations", async () => {
    const admin = await seedAdmin({ permissions: ["properties.write", "support.write"] });

    const create = await request(app)
      .post("/api/v1/admin/locations")
      .set("Authorization", bearer(admin.token))
      .send({
        kind: "city",
        name: "Chennai",
        key: "chennai",
        cityKey: "chennai",
        state: "Tamil Nadu",
        active: true,
        order: 1
      });
    expect(create.status).toBe(201);
    expect(create.body.data.referenceId).toMatch(/^BG-LOC-/);

    const list = await request(app)
      .get("/api/v1/admin/locations?kind=city&cityKey=chennai")
      .set("Authorization", bearer(admin.token));
    expect(list.status).toBe(200);
    expect(list.body.data.some((item) => item.key === "chennai")).toBe(true);
  });

  test("creates a boost order for a property", async () => {
    const admin = await seedAdmin({ permissions: ["properties.write", "support.write"] });
    const property = await seedProperty();

    const create = await request(app)
      .post("/api/v1/admin/boost-orders")
      .set("Authorization", bearer(admin.token))
      .send({
        propertyId: String(property._id),
        planId: "bp2",
        startsAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        status: "active"
      });
    expect(create.status).toBe(201);
    expect(create.body.data.referenceId).toMatch(/^BG-BST-/);
    expect(create.body.data.planSnapshot.name).toBe("Featured");

    const list = await request(app)
      .get(`/api/v1/admin/boost-orders?propertyId=${property._id}`)
      .set("Authorization", bearer(admin.token));
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
  });

  test("google and apple oauth endpoints are not available", async () => {
    const google = await request(app).post("/api/v1/auth/customer/oauth/google").send({});
    const apple = await request(app).post("/api/v1/auth/customer/oauth/apple").send({});
    expect(google.status).toBe(404);
    expect(apple.status).toBe(404);
  });
});
