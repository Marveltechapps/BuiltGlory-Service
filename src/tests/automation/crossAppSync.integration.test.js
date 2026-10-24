import { jest } from "@jest/globals";
import request from "supertest";
import { BuyEnquiry } from "../../modules/buyEnquiries/buyEnquiries.model.js";
import { Visit } from "../../modules/visits/visits.model.js";
import { corsOriginOption } from "../../config/cors.js";
import { app, bearer, seedAdmin, seedCustomer, seedProperty, setupIntegrationDb } from "../helpers/integrationHarness.js";

jest.setTimeout(120_000);
setupIntegrationDb();

const idOf = (body) => body?.data?._id || body?.data?.id;

describe("cors allow-list", () => {
  test("trims origins and rejects a wildcard when credentials are enabled", () => {
    expect(corsOriginOption(" http://localhost:3000, http://localhost:5173 ", "production")).toEqual([
      "http://localhost:3000",
      "http://localhost:5173"
    ]);
    expect(corsOriginOption("*", "production")).toBe(false);
    expect(corsOriginOption("", "production")).toBe(false);
    expect(corsOriginOption("", "development")).toBe(true);
  });

  test("development allows localhost on any port and rejects other origins", (done) => {
    const check = corsOriginOption("http://localhost:3000", "development");
    check("http://localhost:5175", (error, allowed) => {
      expect(error).toBeNull();
      expect(allowed).toBe(true);
      check("https://evil.example", (deniedError, denied) => {
        expect(deniedError).toBeNull();
        expect(denied).toBe(false);
        done();
      });
    });
  });
});

describe("customer to dashboard sync", () => {
  test("a customer enquiry is stored, visible to admin, updated, and hidden from other customers", async () => {
    const owner = await seedCustomer({ name: "Enquiry Owner" });
    const intruder = await seedCustomer({ name: "Other Customer" });
    const admin = await seedAdmin({ permissions: ["enquiries.read", "enquiries.write"] });
    const property = await seedProperty({ title: "Shared Listing" });

    const anonymous = await request(app).post("/api/v1/buy-enquiries").send({
      propertyId: String(property._id),
      preferredContact: "phone",
      interestType: "more_details"
    });
    expect(anonymous.status).toBe(401);

    const invalid = await request(app)
      .post("/api/v1/buy-enquiries")
      .set("Authorization", bearer(owner.token))
      .send({});
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe("VALIDATION_ERROR");
    expect(invalid.body.error.stack).toBeUndefined();

    const created = await request(app)
      .post("/api/v1/buy-enquiries")
      .set("Authorization", bearer(owner.token))
      .send({
        propertyId: String(property._id),
        preferredContact: "phone",
        interestType: "more_details",
        additionalMessage: "Please call after 6"
      });
    expect(created.status).toBe(201);
    const enquiryId = idOf(created.body);
    expect(enquiryId).toBeTruthy();

    const stored = await BuyEnquiry.findById(enquiryId);
    expect(stored).toBeTruthy();
    expect(stored.status).toBe("new");
    expect(String(stored.buyerId)).toBe(String(owner.user._id));
    expect(stored.additionalMessage).toBe("Please call after 6");

    const adminList = await request(app)
      .get("/api/v1/admin/buy-enquiries")
      .set("Authorization", bearer(admin.token));
    expect(adminList.status).toBe(200);
    expect(adminList.body.data.map((row) => String(row._id))).toContain(String(enquiryId));

    const customerDenied = await request(app)
      .get("/api/v1/admin/buy-enquiries")
      .set("Authorization", bearer(owner.token));
    expect(customerDenied.status).toBe(401);

    const updated = await request(app)
      .patch(`/api/v1/admin/buy-enquiries/${enquiryId}`)
      .set("Authorization", bearer(admin.token))
      .send({ status: "responded", notes: "Advisor called" });
    expect(updated.status).toBe(200);
    expect(updated.body.data.status).toBe("responded");
    expect((await BuyEnquiry.findById(enquiryId)).status).toBe("responded");

    const ownerRead = await request(app)
      .get(`/api/v1/me/buy-enquiries/${enquiryId}`)
      .set("Authorization", bearer(owner.token));
    expect(ownerRead.status).toBe(200);
    expect(ownerRead.body.data.status).toBe("responded");
    expect(ownerRead.body.data.additionalMessage).toBe("Please call after 6");

    const crossRead = await request(app)
      .get(`/api/v1/me/buy-enquiries/${enquiryId}`)
      .set("Authorization", bearer(intruder.token));
    const missing = await request(app)
      .get("/api/v1/me/buy-enquiries/507f1f77bcf86cd799439011")
      .set("Authorization", bearer(intruder.token));
    expect(crossRead.status).toBe(404);
    expect(crossRead.body.error.message).toBe(missing.body.error.message);
    expect(JSON.stringify(crossRead.body)).not.toContain("Please call after 6");

    const intruderList = await request(app)
      .get("/api/v1/me/buy-enquiries")
      .set("Authorization", bearer(intruder.token));
    expect(intruderList.body.data.map((row) => String(row._id))).not.toContain(String(enquiryId));

    const cancelled = await request(app)
      .patch(`/api/v1/me/buy-enquiries/${enquiryId}/cancel`)
      .set("Authorization", bearer(owner.token))
      .send({ reason: "Changed my mind" });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.data.status).toBe("closed");
    expect(cancelled.body.data.cancelReason).toBe("Changed my mind");

    const adminAfterCancel = await request(app)
      .get(`/api/v1/admin/buy-enquiries/${enquiryId}`)
      .set("Authorization", bearer(admin.token));
    expect(adminAfterCancel.status).toBe(200);
    expect(adminAfterCancel.body.data.status).toBe("closed");
    expect((await BuyEnquiry.findById(enquiryId)).isDeleted).not.toBe(true);
  });

  test("a visit booked without an enquiry is stored, listed for admin, and updated for the customer", async () => {
    const owner = await seedCustomer();
    const intruder = await seedCustomer();
    const admin = await seedAdmin({ permissions: ["enquiries.read", "enquiries.write"] });
    const property = await seedProperty();
    const visitDate = new Date(Date.now() + 2 * 86400000).toISOString();

    const invalid = await request(app)
      .post("/api/v1/visits")
      .set("Authorization", bearer(owner.token))
      .send({ visitType: "physical" });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe("VALIDATION_ERROR");

    const created = await request(app)
      .post("/api/v1/visits")
      .set("Authorization", bearer(owner.token))
      .send({
        propertyId: String(property._id),
        visitDate,
        visitTime: "10:00",
        visitType: "physical"
      });
    expect(created.status).toBe(201);
    const visitId = idOf(created.body);
    expect(created.body.data.enquiryId).toBeFalsy();

    const stored = await Visit.findById(visitId);
    expect(stored).toBeTruthy();
    expect(String(stored.buyerId)).toBe(String(owner.user._id));
    expect(stored.enquiryId).toBeFalsy();

    const customerVisits = await request(app)
      .get("/api/v1/me/visits")
      .set("Authorization", bearer(owner.token));
    expect(customerVisits.status).toBe(200);
    const row = customerVisits.body.data.find((item) => String(item._id) === String(visitId));
    expect(row).toBeTruthy();
    expect(row.propertySnapshot.title).toBe(property.title);
    expect(row.status).toBe("scheduled");

    const viaEnquiries = await request(app)
      .get("/api/v1/me/buy-enquiries")
      .set("Authorization", bearer(owner.token));
    const embedded = (viaEnquiries.body.data || []).flatMap((enquiry) => enquiry.visits || []);
    expect(embedded.map((item) => String(item._id))).not.toContain(String(visitId));

    const adminList = await request(app)
      .get("/api/v1/admin/visits")
      .set("Authorization", bearer(admin.token));
    expect(adminList.status).toBe(200);
    expect(adminList.body.data.map((item) => String(item._id))).toContain(String(visitId));

    const denied = await request(app)
      .patch(`/api/v1/admin/visits/${visitId}/status`)
      .set("Authorization", bearer(owner.token))
      .send({ status: "confirmed" });
    expect(denied.status).toBe(401);

    const confirmed = await request(app)
      .patch(`/api/v1/admin/visits/${visitId}/status`)
      .set("Authorization", bearer(admin.token))
      .send({ status: "confirmed" });
    expect(confirmed.status).toBe(200);
    expect((await Visit.findById(visitId)).status).toBe("confirmed");

    const afterUpdate = await request(app)
      .get("/api/v1/me/visits")
      .set("Authorization", bearer(owner.token));
    expect(afterUpdate.body.data.find((item) => String(item._id) === String(visitId)).status).toBe("confirmed");

    const otherList = await request(app)
      .get("/api/v1/me/visits")
      .set("Authorization", bearer(intruder.token));
    expect(otherList.status).toBe(200);
    expect((otherList.body.data || []).map((item) => String(item._id))).not.toContain(String(visitId));

    const cancelled = await request(app)
      .patch(`/api/v1/visits/${visitId}/cancel`)
      .set("Authorization", bearer(owner.token))
      .send({ reason: "Plans changed" });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.data.status).toBe("cancelled");
    const stillListed = await request(app)
      .get("/api/v1/me/visits")
      .set("Authorization", bearer(owner.token));
    expect(stillListed.body.data.find((item) => String(item._id) === String(visitId)).status).toBe("cancelled");
    expect((await Visit.findById(visitId)).isDeleted).not.toBe(true);
  });
});
