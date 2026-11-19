import mongoose from "mongoose";
import request from "supertest";
import {
  app,
  bearer,
  models,
  seedCustomer,
  seedProperty,
  seedSalesDeal,
  setupIntegrationDb
} from "./helpers/integrationHarness.js";
import { makeReferenceId } from "../utils/id.js";

setupIntegrationDb();

describe("buyer deal documents", () => {
  test("lists shared documents and registration for the buyer deal owner", async () => {
    const { user, token } = await seedCustomer();
    const property = await seedProperty({ title: "Sunrise Heights" });
    const deal = await seedSalesDeal(user._id, property._id, {
      stage: "documentation",
      propertySnapshot: { title: "Sunrise Heights", price: 8500000 },
      documentation: {
        registration: {
          appointment: {
            date: "2026-12-15T10:00:00.000Z",
            time: "10:00 AM",
            office: "SRO Adyar",
            address: "Adyar, Chennai"
          },
          checklist: ["Original title deed", "Buyer Aadhaar"]
        },
        docs: []
      }
    });

    const docId = new mongoose.Types.ObjectId();
    await models.Document.collection.insertOne({
      _id: docId,
      referenceId: makeReferenceId("documents"),
      ownerType: "sales_deal",
      ownerId: deal._id,
      purpose: "deal_document",
      documentType: "sale_deed",
      fileName: "sale-deed.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
      storageKey: `deal_document/sales_deal/${deal._id}/sale-deed.pdf`,
      status: "uploaded",
      scanStatus: "clean",
      uploadedBy: user._id,
      isPrivate: true,
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await models.SalesDeal.findByIdAndUpdate(deal._id, {
      $set: {
        "documentation.docs": [{ documentId: String(docId), name: "Sale Deed" }]
      }
    });

    const res = await request(app)
      .get(`/api/v1/me/deals/${deal._id}/documents`)
      .set("Authorization", bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.data.dealId).toBe(String(deal._id));
    expect(res.body.data.documents.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.registration.appointment.office).toBe("SRO Adyar");
    expect(res.body.data.registration.checklist).toContain("Original title deed");

    const detail = await request(app)
      .get(`/api/v1/me/deals/${deal._id}`)
      .set("Authorization", bearer(token));

    expect(detail.status).toBe(200);
    expect(detail.body.data._id).toBe(String(deal._id));
    expect(detail.body.data.registration.appointment.time).toBe("10:00 AM");
  });

  test("forbids another customer from reading the deal documents", async () => {
    const owner = await seedCustomer();
    const other = await seedCustomer();
    const property = await seedProperty();
    const deal = await seedSalesDeal(owner.user._id, property._id);

    const res = await request(app)
      .get(`/api/v1/me/deals/${deal._id}/documents`)
      .set("Authorization", bearer(other.token));

    expect(res.status).toBe(404);
  });
});
