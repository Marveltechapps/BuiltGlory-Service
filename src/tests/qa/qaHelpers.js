// Shared QA helpers. Everything goes through HTTP except where a dependency (S3) is disabled in the
// isolated environment; those preconditions are named explicitly.
import request from "supertest";
import mongoose from "mongoose";
import { expect } from "@jest/globals";
import { app, bearer } from "../helpers/integrationHarness.js";
import { getRedis } from "../../config/redis.js";
import { makeReferenceId } from "../../utils/id.js";

export const oid = (id) => new mongoose.Types.ObjectId(String(id));
const M = {
  users: "User", sellrequests: "SellRequest", acquisitions: "Acquisition", properties: "Property", buyenquiries: "BuyEnquiry",
  visits: "Visit", salesdeals: "SalesDeal", payments: "Payment", adminsettings: "AdminSetting", auditlogs: "AuditLog",
  documents: "Document", notifications: "Notification", supporttickets: "SupportTicket", favorites: "Favorite"
};
export const col = (name) => mongoose.model(M[name]).collection;
export const find = (name, id) => col(name).findOne({ _id: oid(id) });

export const api = (method, path, token) => {
  const r = request(app)[method](`/api/v1${path}`);
  return token ? r.set("Authorization", bearer(token)) : r;
};

/** Evidence-friendly assertion: on failure Jest prints the whole response body. */
export const expectStatus = (res, expected, label = "") => {
  const ok = Array.isArray(expected) ? expected.includes(res.status) : res.status === expected;
  if (!ok) expect({ label, status: res.status, body: res.body }).toEqual({ label, status: expected });
  return res;
};

let phoneSeq = 0;
export const nextPhone = () => `9${String(Date.now()).slice(-7)}${String(++phoneSeq % 100).padStart(2, "0")}`;

/** Registers / logs in a customer through the real OTP endpoints (SMS_DELIVERY_MODE=log). */
export const otpLogin = async (phone = nextPhone()) => {
  const send = await request(app).post("/api/v1/auth/customer/otp/send").set("X-Device-Id", `qa-${phone}`).send({ phone, countryCode: "+91" });
  expectStatus(send, 200, "otp-send");
  const requestId = send.body.data?.requestId || (await getRedis().get(`otp:latest:91${phone}`));
  const otp = (await getRedis().get(`otp:plain:${requestId}`)) || JSON.parse(await getRedis().get(`otp:${requestId}`))?.otp;
  const verify = await request(app).post("/api/v1/auth/customer/otp/verify").send({ phone, countryCode: "+91", otp, requestId });
  expectStatus(verify, 200, "otp-verify");
  const data = verify.body.data;
  return { phone, token: data.accessToken, refreshToken: data.refreshToken, userId: String(data.user?._id || data.user?.id) };
};

/** Precondition stand-in for POST /uploads (S3 disabled): inserts clean Document rows owned by the user. */
export const insertUploadedDocs = async (userId, purpose, types) => {
  const now = new Date();
  const docs = types.map((type) => ({
    _id: new mongoose.Types.ObjectId(), referenceId: makeReferenceId("documents"), ownerType: "user", ownerId: oid(userId), uploadedBy: oid(userId),
    purpose, documentType: type, fileName: `${type}.pdf`, mimeType: "application/pdf", url: `s3://qa/${type}.pdf`, s3Key: `qa/${type}.pdf`,
    scanStatus: "clean", isDeleted: false, createdAt: now, updatedAt: now
  }));
  await col("documents").insertMany(docs);
  return docs;
};

/** KYC submit (customer) + verify (admin) through HTTP. */
export const completeKyc = async (customer, adminToken) => {
  const docs = await insertUploadedDocs(customer.userId, "kyc", ["pan", "aadhaar"]);
  expectStatus(await api("post", "/me/kyc", customer.token).send({ documents: docs.map((d) => ({ documentId: String(d._id), type: d.documentType })) }), 200, "kyc-submit");
  const user = await find("users", customer.userId);
  expect(user.kycStatus).toBe("pending");
  expectStatus(await api("patch", `/admin/users/${customer.userId}/kyc`, adminToken).send({
    documentUpdates: user.kycDocuments.map((d) => ({ documentId: String(d._id), status: "verified" })), status: "verified"
  }), 200, "kyc-review");
  expect((await find("users", customer.userId)).kycStatus).toBe("verified");
};

export const sellPayload = (overrides = {}) => ({
  propertyType: "plot",
  propertyTitle: "QA Lifecycle Plot",
  askingPrice: 2500000,
  negotiable: true,
  address: { street: "1 QA Road", locality: "Whitefield", city: "Bengaluru", state: "Karnataka", pincode: "560066" },
  specifications: { plotArea: 1500, facing: "East" },
  ownershipType: "Freehold",
  photos: ["s3://qa/1.jpg", "s3://qa/2.jpg", "s3://qa/3.jpg", "s3://qa/4.jpg", "s3://qa/5.jpg"],
  ...overrides
});

export const LEGAL_DOCUMENTATION = {
  ownership_verified: true, encumbrance_clear: true, tax_clear: true, litigation_clear: true, approvals_verified: true,
  legalVerification: { advocateAssigned: true, advocate: "QA Advocate", verificationStatus: "completed", certificateUploaded: true, certificateUrl: "s3://qa/legal-cert.pdf" }
};

/** Walks an acquisition from pending_review to acquired using the data each backend gate requires. */
export const acquire = async (acqId, adminToken, { agreedPrice = 2350000, valuation = 2300000 } = {}) => {
  const steps = [
    { stage: "site_inspection", notes: "QA inspection" },
    { stage: "valuation", notes: "QA valuation" },
    { stage: "negotiation", valuation: { amount: valuation } },
    { stage: "token_to_seller", negotiation: { agreedPrice } },
    { stage: "documentation", token: { paid: true, amount: 100000, reference: "QA-SELLER-TOKEN" } },
    { stage: "seller_payout", documentation: LEGAL_DOCUMENTATION },
    { stage: "acquired", payout: { completed: true, amount: agreedPrice - 100000, reference: "QA-PAYOUT" } }
  ];
  const log = [];
  for (const body of steps) {
    const res = await api("patch", `/admin/acquisitions/${acqId}/stage`, adminToken).send(body);
    log.push({ to: body.stage, status: res.status, error: res.status >= 400 ? res.body?.error : undefined });
    if (res.status >= 400) break;
  }
  return log;
};

/** Converts an acquired acquisition to a property, completes required fields, and publishes it. */
// WORKAROUND for QA-BUG-001: the dashboard sends no body and the copied sell address (address.street) makes
// Property.create throw. Passing an explicit address is a supported API input that lets downstream steps be tested.
export const QA_BUG_001_ADDRESS = { line1: "1 QA Road", locality: "Whitefield", city: "Bengaluru", state: "Karnataka", pincode: "560066" };
export const publishFromAcquisition = async (acqId, adminToken, price = 2900000) => {
  const conv = expectStatus(await api("post", `/admin/acquisitions/${acqId}/convert-to-property`, adminToken).send({ address: QA_BUG_001_ADDRESS }), [200, 201], "convert-to-property");
  const propertyId = String(conv.body.data?._id || conv.body.data?.propertyId || conv.body.data?.property?._id);
  expectStatus(await api("patch", `/admin/properties/${propertyId}`, adminToken).send({
    title: "QA Lifecycle Plot", description: "Published by QA lifecycle", price, isVisibleOnApp: true, // mirrors dashboard publish (useProperties.ts:68)
    address: { line1: "1 QA Road", locality: "Whitefield", city: "Bengaluru", state: "Karnataka", pincode: "560066" },
    media: { photos: ["s3://qa/1.jpg"], coverPhoto: "s3://qa/1.jpg" }
  }), 200, "property-complete");
  expectStatus(await api("patch", `/admin/properties/${propertyId}/status`, adminToken).send({ status: "available" }), 200, "property-publish");
  return propertyId;
};

/** Buyer enquiry → admin deal → stages to negotiation. Returns ids. */
export const openDeal = async (buyer, propertyId, adminToken) => {
  const enq = expectStatus(await api("post", "/buy-enquiries", buyer.token).send({ propertyId, preferredContact: "phone", interestType: "schedule_visit", preferredVisitTime: "this_weekend_morning", enquiryTypes: ["buy"] }), 201, "enquiry");
  const enquiryId = enq.body.data._id;
  const deal = expectStatus(await api("post", `/admin/buy-enquiries/${enquiryId}/convert-to-deal`, adminToken).send({}), 201, "convert-to-deal");
  const dealId = deal.body.data._id;
  for (const stage of ["site_visits", "negotiation"]) expectStatus(await api("patch", `/admin/sales/deals/${dealId}/stage`, adminToken).send({ stage }), 200, `deal-${stage}`);
  return { enquiryId, dealId };
};

export const tokenAmountSetting = async () => {
  const settings = await col("adminsettings").findOne({});
  return Number(settings?.payment?.tokenAmount ?? 250000);
};

/** Seeds a published property via the full seller → acquisition path. */
export const listedProperty = async (adminToken) => {
  const seller = await otpLogin();
  await completeKyc(seller, adminToken);
  const sell = expectStatus(await api("post", "/sell-requests", seller.token).send(sellPayload()), [200, 201], "sell-create");
  const acq = expectStatus(await api("post", `/admin/sell-requests/${sell.body.data._id}/create-acquisition`, adminToken).send({}), 201, "create-acquisition");
  const log = await acquire(acq.body.data._id, adminToken);
  if (log.at(-1).status >= 400) expect(log).toEqual("acquisition reached acquired");
  const propertyId = await publishFromAcquisition(acq.body.data._id, adminToken);
  return { seller, sellId: sell.body.data._id, acqId: acq.body.data._id, propertyId };
};
