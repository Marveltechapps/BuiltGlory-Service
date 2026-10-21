import { jest } from "@jest/globals";
import request from "supertest";
import { User } from "../../modules/users/model.js";
import { Property } from "../../modules/properties/model.js";
import { app, bearer, seedAdmin, seedBuyEnquiry, seedCustomer, seedProperty, setupIntegrationDb } from "../helpers/integrationHarness.js";

jest.setTimeout(120_000);
setupIntegrationDb();

describe("property workflow", () => {
  test("creates, lists, updates, and soft-deletes a property with validation boundaries", async () => {
    const admin = await seedAdmin({ permissions: ["properties.read", "properties.write", "properties.publish"] });
    const customer = await seedCustomer();
    const auth = { Authorization: bearer(admin.token) };

    const missing = await request(app).post("/api/v1/admin/properties").set(auth).send({ type: "plot" });
    expect(missing.status).toBe(400);
    expect(missing.body.error.code).toBe("VALIDATION_ERROR");

    const invalidType = await request(app).post("/api/v1/admin/properties").set(auth).send({ title: "Bad", type: "castle", price: 10 });
    expect(invalidType.status).toBe(400);

    const created = await request(app).post("/api/v1/admin/properties").set(auth).send({
      title: "Workflow Plot",
      description: "A tested listing",
      type: "plot",
      status: "draft",
      price: 1500000,
      address: { city: "Bengaluru", locality: "Whitefield", pincode: "560066" }
    });
    expect(created.status).toBe(201);
    const propertyId = created.body.data._id || created.body.data.id;
    expect(propertyId).toBeTruthy();
    expect(created.body.data.passwordHash).toBeUndefined();

    const stored = await Property.findById(propertyId);
    expect(stored.title).toBe("Workflow Plot");
    expect(stored.isDeleted).not.toBe(true);

    const denied = await request(app).patch(`/api/v1/admin/properties/${propertyId}`).set("Authorization", bearer(customer.token)).send({ title: "Hijack" });
    expect(denied.status).toBe(401);
    expect((await Property.findById(propertyId)).title).toBe("Workflow Plot");

    const renamed = await request(app).patch(`/api/v1/admin/properties/${propertyId}`).set(auth).send({ title: "Workflow Plot Updated" });
    expect(renamed.status).toBe(200);
    expect((await Property.findById(propertyId)).title).toBe("Workflow Plot Updated");

    const publicList = await request(app).get("/api/v1/properties");
    expect(publicList.body.data.map((row) => row.title)).not.toContain("Workflow Plot Updated");

    const overLimit = await request(app).get("/api/v1/properties?limit=101");
    expect(overLimit.status).toBe(400);
    const badPage = await request(app).get("/api/v1/properties?page=0");
    expect(badPage.status).toBe(400);
    const badSort = await request(app).get("/api/v1/admin/properties?sort=drop-table").set(auth);
    expect(badSort.status).toBe(400);

    const missingResource = await request(app).get("/api/v1/admin/properties/507f1f77bcf86cd799439011").set(auth);
    expect(missingResource.status).toBe(404);

    const removed = await request(app).delete(`/api/v1/admin/properties/${propertyId}`).set(auth);
    expect(removed.status).toBe(200);
    const afterDelete = await Property.findById(propertyId);
    expect(afterDelete.isDeleted).toBe(true);
    const hidden = await request(app).get(`/api/v1/admin/properties/${propertyId}`).set(auth);
    expect(hidden.status).toBe(404);
  });
});

describe("customer isolation", () => {
  test("one customer cannot read another customer's enquiry or profile secrets", async () => {
    const owner = await seedCustomer({ name: "Owner Customer" });
    const intruder = await seedCustomer({ name: "Other Customer" });
    const property = await seedProperty();
    const enquiry = await seedBuyEnquiry(owner.user._id, property._id);
    await User.updateOne({ _id: owner.user._id }, { $set: { otp: "654321", otpExpiry: new Date(Date.now() + 60_000) } });

    const crossRead = await request(app).get(`/api/v1/me/buy-enquiries/${enquiry._id}`).set("Authorization", bearer(intruder.token));
    const missing = await request(app).get("/api/v1/me/buy-enquiries/507f1f77bcf86cd799439011").set("Authorization", bearer(intruder.token));
    expect(crossRead.status).toBe(404);
    expect(crossRead.body.error.code).toBe("NOT_FOUND");
    expect(crossRead.body.error.message).toBe(missing.body.error.message);
    expect(JSON.stringify(crossRead.body)).not.toContain(String(enquiry.referenceId));

    const ownList = await request(app).get("/api/v1/me/buy-enquiries").set("Authorization", bearer(owner.token));
    expect(ownList.status).toBe(200);
    expect(ownList.body.data.map((row) => String(row._id))).toContain(String(enquiry._id));

    const otherList = await request(app).get("/api/v1/me/buy-enquiries").set("Authorization", bearer(intruder.token));
    expect(otherList.status).toBe(200);
    expect(otherList.body.data.map((row) => String(row._id))).not.toContain(String(enquiry._id));

    const profile = await request(app).get("/api/v1/me").set("Authorization", bearer(owner.token));
    expect(profile.status).toBe(200);
    expect(profile.body.data.name).toBe("Owner Customer");
    expect(profile.body.data.otp).toBeUndefined();
    expect(profile.body.data.passwordHash).toBeUndefined();
    expect(JSON.stringify(profile.body)).not.toContain("654321");
  });
});

describe("public input boundaries", () => {
  test("geo reverse rejects missing and out-of-range coordinates and accepts a known city", async () => {
    const missing = await request(app).get("/api/v1/geo/reverse");
    expect(missing.status).toBe(422);
    expect(missing.body.error.code).toBe("DOMAIN_RULE_VIOLATION");

    const badType = await request(app).get("/api/v1/geo/reverse?latitude=south&longitude=east");
    expect(badType.status).toBe(422);

    const outOfRange = await request(app).get("/api/v1/geo/reverse?latitude=120&longitude=10");
    expect(outOfRange.status).toBe(422);

    const chennai = await request(app).get("/api/v1/geo/reverse?latitude=13.08&longitude=80.27");
    expect(chennai.status).toBe(200);
    expect(chennai.body.data.city).toBe("Chennai");
  });

  test("app config is public and does not include secrets", async () => {
    const config = await request(app).get("/api/v1/app/config");
    expect(config.status).toBe(200);
    const serialized = JSON.stringify(config.body).toLowerCase();
    expect(serialized).not.toMatch(/password|secret|private_key|razorpay_key_secret/);
  });
});
