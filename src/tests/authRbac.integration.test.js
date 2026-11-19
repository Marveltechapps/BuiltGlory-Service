import mongoose from "mongoose";
import request from "supertest";
import { app, bearer, seedAdmin, seedCustomer, setupIntegrationDb } from "./helpers/integrationHarness.js";
import { Document } from "../modules/documents/documents.model.js";
import { makeReferenceId } from "../utils/id.js";

setupIntegrationDb();

describe("auth and RBAC integration", () => {
  test("admin token can access protected admin route", async () => {
    const admin = await seedAdmin();
    const list = await request(app).get("/api/v1/admin/properties").set("Authorization", bearer(admin.token));
    expect(list.status).toBe(200);
    expect(list.body).toHaveProperty("data");
  });

  test("admin login validates malformed payload", async () => {
    const res = await request(app).post("/api/v1/auth/admin/login").send({ email: "not-an-email", password: "short" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  test("RBAC denies missing permission and allows matching permission", async () => {
    const limited = await seedAdmin({ role: "support", permissions: ["support.read"] });
    const denied = await request(app).get("/api/v1/admin/properties").set("Authorization", bearer(limited.token));
    expect(denied.status).toBe(403);

    const allowedAdmin = await seedAdmin({ permissions: ["properties.read"] });
    const allowed = await request(app).get("/api/v1/admin/properties").set("Authorization", bearer(allowedAdmin.token));
    expect(allowed.status).toBe(200);
  });

  test("customer token cannot access admin route", async () => {
    const { token } = await seedCustomer();
    const res = await request(app).get("/api/v1/admin/users").set("Authorization", bearer(token));
    expect(res.status).toBe(401);
  });

  test("unauthenticated protected route returns unauthorized envelope", async () => {
    const res = await request(app).get("/api/v1/me");
    expect(res.status).toBe(401);
    expect(res.body.error).toBeTruthy();
    expect(res.body.meta.requestId).toBeTruthy();
  });

  test("customer can save detected profile location coordinates", async () => {
    const { token } = await seedCustomer();
    const res = await request(app)
      .patch("/api/v1/me")
      .set("Authorization", bearer(token))
      .send({
        city: "Chennai",
        state: "Tamil Nadu",
        country: "India",
        latitude: 13.0827,
        longitude: 80.2707,
        userType: "resident"
      });

    expect(res.status).toBe(200);
    expect(res.body.data.city).toBe("Chennai");
    expect(res.body.data.state).toBe("Tamil Nadu");
    expect(res.body.data.latitude).toBe(13.0827);
    expect(res.body.data.longitude).toBe(80.2707);
  });

  test("customer profile update ignores block and assignment fields", async () => {
    const { token, user } = await seedCustomer({ name: "Aarav Subramanian" });
    const { admin } = await seedAdmin();
    const res = await request(app)
      .patch("/api/v1/me")
      .set("Authorization", bearer(token))
      .send({ name: "Aarav Subramanian", isBlocked: true, assignedTo: String(admin._id), status: "verified" });

    expect(res.status).toBe(200);
    expect(res.body.data.isBlocked).toBe(false);
    expect(res.body.data.assignedTo ?? null).toBeNull();

    const onlyPrivileged = await request(app)
      .patch("/api/v1/me")
      .set("Authorization", bearer(token))
      .send({ isBlocked: false, assignedTo: String(admin._id) });
    expect(onlyPrivileged.status).toBe(422);
    expect(user.isBlocked).toBe(false);
  });

  test("customer KYC upload is attached to the profile as pending", async () => {
    const { token, user } = await seedCustomer({ kycStatus: "not_submitted", kycDocuments: [] });
    const pan = await Document.create({
      referenceId: makeReferenceId("documents"),
      ownerType: "user",
      ownerId: user._id,
      purpose: "kyc",
      documentType: "pan",
      fileName: "pan.pdf",
      mimeType: "application/pdf",
      storageKey: `kyc/user/${user._id}/pan.pdf`,
      isPrivate: true,
      status: "uploaded",
      scanStatus: "clean"
    });
    const aadhaar = await Document.create({
      referenceId: makeReferenceId("documents"),
      ownerType: "user",
      ownerId: user._id,
      purpose: "kyc",
      documentType: "aadhaar",
      fileName: "aadhaar.pdf",
      mimeType: "application/pdf",
      storageKey: `kyc/user/${user._id}/aadhaar.pdf`,
      isPrivate: true,
      status: "uploaded",
      scanStatus: "clean"
    });

    const res = await request(app)
      .post("/api/v1/me/kyc")
      .set("Authorization", bearer(token))
      .send({
        documents: [
          { documentId: String(pan._id), type: "pan" },
          { documentId: String(aadhaar._id), type: "aadhaar" }
        ]
      });

    expect(res.status).toBe(200);
    expect(res.body.data.kycStatus).toBe("pending");
    expect(res.body.data.kycDocuments.map((doc) => doc.type).sort()).toEqual(["aadhaar", "pan"]);

    const foreign = new mongoose.Types.ObjectId();
    const rejected = await request(app)
      .post("/api/v1/me/kyc")
      .set("Authorization", bearer(token))
      .send({ documents: [{ documentId: String(foreign), type: "pan" }] });
    expect(rejected.status).toBe(422);
  });
});
