import { sendOtpSchema as authOtpSchema } from "../modules/auth/auth.schemas.js";
import { createSchema as propertyCreateSchema, listSchema as propertyListSchema } from "../modules/properties/properties.schemas.js";
import { createSchema as paymentCreateSchema } from "../modules/payments/payments.schemas.js";
import { createSchema as visitCreateSchema } from "../modules/visits/visits.schemas.js";
import { createSchema as supportCreateSchema } from "../modules/supportTickets/supportTickets.schemas.js";
import { createSchema as callbackCreateSchema } from "../modules/callbacks/callbacks.schemas.js";
import { createSchema as sellCreateSchema, updateSchema as sellUpdateSchema } from "../modules/sellRequests/sellRequests.schemas.js";
import { listSchema as acquisitionListSchema, updateSchema as acquisitionUpdateSchema, statusSchema as acquisitionStatusSchema } from "../modules/acquisitions/acquisitions.schemas.js";
import { createSchema as salesCreateSchema, updateSchema as salesUpdateSchema, statusSchema as salesStatusSchema, listSchema as salesListSchema } from "../modules/salesDeals/salesDeals.schemas.js";
import { collectSubmissionIssues } from "../modules/sellRequests/sellRequests.rules.js";

const ok = (schema, value) => schema.safeParse(value).success;
const bad = (schema, value) => !schema.safeParse(value).success;

describe("representative request validators (Zod)", () => {
  test("rejects invalid auth OTP payload", () => {
    expect(bad(authOtpSchema, { body: { phone: "123" } })).toBe(true);
  });

  test("accepts documented property create payload and rejects unknown keys", () => {
    expect(ok(propertyCreateSchema, { body: { title: "Plot", type: "plot", price: 1000000, address: { city: "Bengaluru" } } })).toBe(true);
    expect(bad(propertyCreateSchema, { body: { title: "Plot", type: "plot", price: 1000000, address: { city: "Bengaluru" }, $set: { status: "sold" } } })).toBe(true);
  });

  test("allows documented property filters", () => {
    expect(ok(propertyListSchema, { query: { city: "Bengaluru", minPrice: 1000, sort: "price_asc", page: 1, limit: 10 } })).toBe(true);
  });

  test("validates payment token creation", () => {
    expect(ok(paymentCreateSchema, { body: { dealId: "0123456789abcdef01234567", amount: 1000, currency: "INR", idempotencyKey: "k1" } })).toBe(true);
    expect(bad(paymentCreateSchema, { body: { dealId: "bad", amount: -1 } })).toBe(true);
    expect(bad(paymentCreateSchema, { body: { dealId: "0123456789abcdef01234567", amount: 1000, method: "razorpay" } })).toBe(true);
  });

  test("validates visit scheduling", () => {
    expect(
      ok(visitCreateSchema, {
        body: {
          propertyId: "0123456789abcdef01234567",
          visitDate: new Date(Date.now() + 86400000).toISOString(),
          visitTime: "10:00",
          visitType: "physical"
        }
      })
    ).toBe(true);
  });

  test("validates support and callback payloads", () => {
    expect(ok(supportCreateSchema, { body: { category: "technical", subject: "Issue", message: "Need help" } })).toBe(true);
    expect(ok(callbackCreateSchema, { body: { source: "help_support", preferredTime: new Date(Date.now() + 86400000).toISOString() } })).toBe(true);
  });

  test("validates sell request draft and update payloads by field type", () => {
    expect(ok(sellCreateSchema, { body: { propertyType: "apartment", isDraft: true, draftStep: 1 } })).toBe(true);
    expect(ok(sellUpdateSchema, { body: { propertyTitle: "Bright 3 BHK in Adyar", askingPrice: 8500000, address: { pincode: "600020", city: "Chennai" } } })).toBe(true);
    expect(bad(sellUpdateSchema, { body: { propertyTitle: "x".repeat(201), askingPrice: -1, address: { pincode: "12" } } })).toBe(true);
    expect(bad(sellUpdateSchema, { body: { askingPrice: 1000 } })).toBe(true);
    expect(bad(sellUpdateSchema, { body: { specifications: { poaHolderPhone: "123", virtualTourUrl: "ftp://bad" } } })).toBe(true);
    expect(ok(sellUpdateSchema, { body: { specifications: { builtUpArea: 1200, poaHolderPhone: "9876543210", virtualTourUrl: "https://tour.example.com" } } })).toBe(true);
  });

  test("collects type-specific sell submission issues", () => {
    const seller = { role: "seller" };
    const base = {
      propertyTitle: "Bright 3 BHK in Adyar",
      askingPrice: 8500000,
      ownershipType: "Freehold",
      address: { street: "Sunrise Heights", city: "Chennai", pincode: "600020" },
      photos: ["1", "2", "3", "4", "5"]
    };
    expect(collectSubmissionIssues({ ...base, propertyType: "apartment", specifications: { bhk: "3 BHK", builtUpArea: 1200 } }, seller)).toHaveLength(0);
    expect(collectSubmissionIssues({ ...base, propertyType: "plot", specifications: { plotArea: 2400 } }, seller)).toHaveLength(0);
    expect(collectSubmissionIssues({ ...base, propertyType: "apartment", specifications: {} }, seller).some((item) => item.field.includes("bhk"))).toBe(true);
    expect(collectSubmissionIssues({ ...base, propertyType: "plot", specifications: {} }, seller).some((item) => item.field.includes("plotArea"))).toBe(true);
    expect(collectSubmissionIssues({ ...base, propertyType: "apartment", loanOnProperty: true, specifications: { bhk: "2 BHK", builtUpArea: 900 } }, seller).some((item) => item.field.startsWith("loanDetails"))).toBe(true);
    expect(collectSubmissionIssues({ propertyTitle: "No" }, seller).length).toBeGreaterThan(0);
  });

  test("validates acquisition list, update, and stage payloads", () => {
    expect(ok(acquisitionListSchema, { query: { stage: "valuation", limit: 20, sort: "newest" } })).toBe(true);
    expect(bad(acquisitionListSchema, { query: { stage: "not_a_stage" } })).toBe(true);
    expect(ok(acquisitionUpdateSchema, { body: { priority: "high", builtgloryOffer: 500000 } })).toBe(true);
    expect(bad(acquisitionUpdateSchema, { body: { builtgloryOffer: -1, priority: "critical" } })).toBe(true);
    expect(ok(acquisitionStatusSchema, { body: { stage: "on_hold", onHoldReason: "Seller travelling" } })).toBe(true);
    expect(bad(acquisitionStatusSchema, { body: { stage: "closed" } })).toBe(true);
  });

  test("validates sales deal create, update, and stage payloads", () => {
    expect(ok(salesListSchema, { query: { stage: "token_payment", search: "aditya" } })).toBe(true);
    expect(ok(salesCreateSchema, { body: { buyerId: "0123456789abcdef01234567", propertyId: "0123456789abcdef01234567" } })).toBe(true);
    expect(bad(salesCreateSchema, { body: { buyerId: "bad" } })).toBe(true);
    expect(ok(salesUpdateSchema, { body: { agreedPrice: 1000000, tokenPaid: true } })).toBe(true);
    expect(bad(salesUpdateSchema, { body: { agreedPrice: 0 } })).toBe(true);
    expect(ok(salesStatusSchema, { body: { stage: "lost", lostReason: "No response" } })).toBe(true);
    expect(bad(salesStatusSchema, { body: { stage: "acquired" } })).toBe(true);
  });
});
