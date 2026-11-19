// QA: business-rule, duplicate, concurrency, negative and boundary scenarios.
// Every test asserts the CORRECT/EXPECTED behaviour. A failing test is a reported defect (see TESTING_REPORT.md).
import { jest } from "@jest/globals";
import { setupIntegrationDb, seedAdmin } from "../helpers/integrationHarness.js";
import { env } from "../../config/env.js";
import {
  api, find, col, oid, expectStatus, otpLogin, completeKyc, sellPayload, acquire, listedProperty, openDeal, tokenAmountSetting, LEGAL_DOCUMENTATION
} from "./qaHelpers.js";

jest.setTimeout(180_000);
setupIntegrationDb();
beforeEach(() => { env.SMS_DELIVERY_MODE = "log"; });

const newAcquisitionFromSell = async (adminToken, { kyc = true, body = {} } = {}) => {
  const seller = await otpLogin();
  if (kyc) await completeKyc(seller, adminToken);
  const sell = expectStatus(await api("post", "/sell-requests", seller.token).send(sellPayload(body)), [200, 201], "sell-create");
  const acq = expectStatus(await api("post", `/admin/sell-requests/${sell.body.data._id}/create-acquisition`, adminToken).send({}), 201, "create-acquisition");
  return { seller, sellId: sell.body.data._id, acqId: acq.body.data._id };
};

describe("QA-BUG-001 acquisition → property conversion (dashboard call shape)", () => {
  test("convert-to-property with no body (as AcquisitionDetailPage sends) creates a draft with the seller address", async () => {
    const { token: adminToken } = await seedAdmin();
    const { acqId } = await newAcquisitionFromSell(adminToken);
    const log = await acquire(acqId, adminToken);
    expect(log.at(-1)).toEqual(expect.objectContaining({ to: "acquired", status: 200 }));
    const conv = await api("post", `/admin/acquisitions/${acqId}/convert-to-property`, adminToken).send();
    expectStatus(conv, [200, 201], "convert-no-body");
    const prop = await find("properties", conv.body.data._id);
    expect(prop.address.line1 || prop.address.street).toBe("1 QA Road");
  });
});

describe("QA-BUG-002 sell request status follows acquisition", () => {
  test("after the acquisition is acquired the sell request is no longer 'new' / 'under_review'", async () => {
    const { token: adminToken } = await seedAdmin();
    const { sellId, acqId } = await newAcquisitionFromSell(adminToken);
    await acquire(acqId, adminToken);
    expect((await find("acquisitions", acqId)).stage).toBe("acquired");
    const sr = await find("sellrequests", sellId);
    expect(["new", "under_review"]).not.toContain(sr.status);
  });
});

describe("QA-BUG-003 seller KYC gate on the acquisition path", () => {
  test("an acquisition for a seller whose KYC is NOT verified cannot reach seller payout / acquired", async () => {
    const { token: adminToken } = await seedAdmin();
    const { seller, acqId } = await newAcquisitionFromSell(adminToken, { kyc: false });
    expect((await find("users", seller.userId)).kycStatus).not.toBe("verified");
    const log = await acquire(acqId, adminToken);
    const reached = (await find("acquisitions", acqId)).stage;
    // Expected: blocked at or before seller_payout with a KYC error.
    expect({ reached, log }).toEqual(expect.objectContaining({ reached: expect.not.stringMatching(/^(seller_payout|acquired)$/) }));
  });
});

describe("QA-BUG-004 self-declared sell documents", () => {
  test("a seller cannot satisfy the mandatory-document gate by posting documents with status 'verified'", async () => {
    const { token: adminToken } = await seedAdmin();
    const seller = await otpLogin();
    await completeKyc(seller, adminToken);
    const forged = ["sale_deed", "khata_certificate", "property_tax_receipt", "identity_proof"].map((documentType) => ({ documentType, status: "verified", fileUrl: "https://example.invalid/fake.pdf" }));
    const sell = expectStatus(await api("post", "/sell-requests", seller.token).send(sellPayload({ documents: forged })), [200, 201], "sell-forged");
    const stored = await find("sellrequests", sell.body.data._id);
    const storedStatuses = (stored.documents || []).map((d) => d.status);
    expectStatus(await api("patch", `/admin/sell-requests/${sell.body.data._id}/review`, adminToken).send({ decision: "under_review" }), 200, "under_review");
    const approve = await api("patch", `/admin/sell-requests/${sell.body.data._id}/review`, adminToken).send({ decision: "approved" });
    // Expected: client-supplied 'verified' is ignored (stored as uploaded/pending) or approval rejected.
    expect({ storedStatuses, approveStatus: approve.status }).toEqual(expect.objectContaining({ approveStatus: 422 }));
  });
});

describe("QA-BUG-005 one property, two buyers", () => {
  test("a second buyer's token cannot be verified once the property is reserved by another buyer", async () => {
    const { token: adminToken } = await seedAdmin();
    const { propertyId } = await listedProperty(adminToken);
    const tokenAmount = await tokenAmountSetting();
    const buyers = [await otpLogin(), await otpLogin()];
    const payments = [];
    for (const b of buyers) {
      await completeKyc(b, adminToken);
      const { dealId } = await openDeal(b, propertyId, adminToken);
      const pay = expectStatus(await api("post", "/payments/token", b.token).send({ dealId, amount: tokenAmount, method: "bank", transactionReference: `QA-${b.phone}` }), 201, "token");
      payments.push({ dealId, paymentId: pay.body.data._id });
    }
    expectStatus(await api("patch", `/admin/payments/${payments[0].paymentId}/verify`, adminToken).send({ decision: "paid" }), 200, "verify-1");
    expect((await find("properties", propertyId)).status).toBe("reserved");
    const second = await api("patch", `/admin/payments/${payments[1].paymentId}/verify`, adminToken).send({ decision: "paid" });
    const deal2 = await find("salesdeals", payments[1].dealId);
    const paidCount = await col("payments").countDocuments({ propertyId: oid(propertyId), status: "paid", type: "token" });
    // Expected: rejected (4xx) and only one paid token for the property.
    expect({ secondStatus: second.status, paidCount, deal2TokenPaid: deal2.financials?.tokenPaid ?? false })
      .toEqual({ secondStatus: expect.any(Number), paidCount: 1, deal2TokenPaid: false });
    expect(second.status).toBeGreaterThanOrEqual(400);
    expect(second.status).toBeLessThan(500);
  });
});

describe("QA-BUG-006 concurrent admin verification", () => {
  test("two simultaneous 'paid' verifications of one payment count the money once", async () => {
    const { token: adminToken } = await seedAdmin();
    const { propertyId } = await listedProperty(adminToken);
    const buyer = await otpLogin();
    await completeKyc(buyer, adminToken);
    const { dealId } = await openDeal(buyer, propertyId, adminToken);
    const tokenAmount = await tokenAmountSetting();
    const pay = expectStatus(await api("post", "/payments/token", buyer.token).send({ dealId, amount: tokenAmount, method: "upi" }), 201, "token");
    const results = await Promise.all([1, 2, 3].map(() => api("patch", `/admin/payments/${pay.body.data._id}/verify`, adminToken).send({ decision: "paid" })));
    const deal = await find("salesdeals", dealId);
    const audits = await col("auditlogs").countDocuments({ resourceType: "payments", resourceId: { $in: [oid(pay.body.data._id), pay.body.data._id] }, action: /status_changed/ });
    expect({ codes: results.map((r) => r.status).sort(), totalPaid: deal.financials.totalPaid, statusChangeAudits: audits })
      .toEqual({ codes: expect.any(Array), totalPaid: tokenAmount, statusChangeAudits: 1 });
  });
});

describe("Duplicate / concurrent requests", () => {
  test("parallel token submissions for one deal create exactly one open payment and no 5xx", async () => {
    const { token: adminToken } = await seedAdmin();
    const { propertyId } = await listedProperty(adminToken);
    const buyer = await otpLogin();
    await completeKyc(buyer, adminToken);
    const { dealId } = await openDeal(buyer, propertyId, adminToken);
    const tokenAmount = await tokenAmountSetting();
    const results = await Promise.all(Array.from({ length: 6 }, () => api("post", "/payments/token", buyer.token).send({ dealId, amount: tokenAmount, method: "upi" })));
    const codes = results.map((r) => r.status);
    const open = await col("payments").countDocuments({ dealId: oid(dealId), status: { $in: ["created", "pending"] } });
    expect({ codes, open }).toEqual({ codes: expect.not.arrayContaining([500]), open: 1 });
  });

  test("same idempotency key replays the same payment", async () => {
    const { token: adminToken } = await seedAdmin();
    const { propertyId } = await listedProperty(adminToken);
    const buyer = await otpLogin();
    const { dealId } = await openDeal(buyer, propertyId, adminToken);
    const tokenAmount = await tokenAmountSetting();
    const a = expectStatus(await api("post", "/payments/token", buyer.token).send({ dealId, amount: tokenAmount, idempotencyKey: "qa-key-1" }), 201, "a");
    const b = await api("post", "/payments/token", buyer.token).send({ dealId, amount: tokenAmount, idempotencyKey: "qa-key-1" });
    expect([200, 201]).toContain(b.status);
    expect(b.body.data._id).toBe(a.body.data._id);
    expect(await col("payments").countDocuments({ dealId: oid(dealId) })).toBe(1);
  });

  test("parallel convert-to-deal on one enquiry creates one deal", async () => {
    const { token: adminToken } = await seedAdmin();
    const { propertyId } = await listedProperty(adminToken);
    const buyer = await otpLogin();
    const enq = expectStatus(await api("post", "/buy-enquiries", buyer.token).send({ propertyId, preferredContact: "phone", interestType: "more_details" }), 201, "enq");
    const results = await Promise.all([1, 2, 3, 4].map(() => api("post", `/admin/buy-enquiries/${enq.body.data._id}/convert-to-deal`, adminToken).send({})));
    const deals = await col("salesdeals").countDocuments({ sourceEnquiryId: oid(enq.body.data._id) });
    expect({ codes: results.map((r) => r.status), deals }).toEqual({ codes: expect.not.arrayContaining([500]), deals: 1 });
  });

  test("parallel duplicate enquiries from one buyer for one property do not multiply", async () => {
    const { token: adminToken } = await seedAdmin();
    const { propertyId } = await listedProperty(adminToken);
    const buyer = await otpLogin();
    const results = await Promise.all([1, 2, 3].map(() => api("post", "/buy-enquiries", buyer.token).send({ propertyId, preferredContact: "phone", interestType: "more_details" })));
    const count = await col("buyenquiries").countDocuments({ propertyId: oid(propertyId), buyerId: oid(buyer.userId), status: { $ne: "closed" } });
    expect({ codes: results.map((r) => r.status), count }).toEqual({ codes: expect.not.arrayContaining([500]), count: 1 });
  });
});

describe("Payments: negative and boundary", () => {
  test("token amount must equal the configured amount; zero/negative rejected", async () => {
    const { token: adminToken } = await seedAdmin();
    const { propertyId } = await listedProperty(adminToken);
    const buyer = await otpLogin();
    const { dealId } = await openDeal(buyer, propertyId, adminToken);
    const tokenAmount = await tokenAmountSetting();
    for (const amount of [tokenAmount - 1, tokenAmount + 1, 1]) expect((await api("post", "/payments/token", buyer.token).send({ dealId, amount })).status).toBe(422);
    for (const amount of [0, -5, "abc"]) expect((await api("post", "/payments/token", buyer.token).send({ dealId, amount })).status).toBe(400);
    expect((await api("post", "/payments/token", buyer.token).send({ dealId, amount: tokenAmount, method: "razorpay" })).status).toBe(400);
    expect(await col("payments").countDocuments({ dealId: oid(dealId) })).toBe(0);
  });

  test("another buyer cannot pay on, cancel, or read someone else's deal/payment", async () => {
    const { token: adminToken } = await seedAdmin();
    const { propertyId } = await listedProperty(adminToken);
    const owner = await otpLogin();
    const other = await otpLogin();
    const { dealId } = await openDeal(owner, propertyId, adminToken);
    const tokenAmount = await tokenAmountSetting();
    const pay = expectStatus(await api("post", "/payments/token", owner.token).send({ dealId, amount: tokenAmount }), 201, "owner-token");
    const foreignPay = await api("post", "/payments/token", other.token).send({ dealId, amount: tokenAmount });
    const foreignCancel = await api("post", `/payments/${pay.body.data._id}/cancel`, other.token).send({});
    const foreignDeal = await api("get", `/me/deals/${dealId}`, other.token);
    const otherPayments = await api("get", "/me/payments", other.token);
    expect({ foreignPay: foreignPay.status, foreignCancel: foreignCancel.status, foreignDeal: foreignDeal.status, otherPaymentsCount: otherPayments.body.data.length })
      .toEqual({ foreignPay: 422, foreignCancel: expect.any(Number), foreignDeal: 404, otherPaymentsCount: 0 });
    expect([403, 404, 422]).toContain(foreignCancel.status);
    expect((await find("payments", pay.body.data._id)).status).toBe("pending");
  });

  test("cancel of a non-existent payment returns 404 (not 500); paid payment cannot be cancelled", async () => {
    const { token: adminToken } = await seedAdmin();
    const { propertyId } = await listedProperty(adminToken);
    const buyer = await otpLogin();
    const { dealId } = await openDeal(buyer, propertyId, adminToken);
    expect((await api("post", "/payments/507f1f77bcf86cd799439011/cancel", buyer.token).send({})).status).toBe(404);
    const tokenAmount = await tokenAmountSetting();
    const pay = expectStatus(await api("post", "/payments/token", buyer.token).send({ dealId, amount: tokenAmount }), 201, "token");
    expectStatus(await api("patch", `/admin/payments/${pay.body.data._id}/verify`, adminToken).send({ decision: "paid" }), 200, "verify");
    expect((await api("post", `/payments/${pay.body.data._id}/cancel`, buyer.token).send({})).status).toBe(422);
    expect((await api("patch", `/admin/payments/${pay.body.data._id}/verify`, adminToken).send({ decision: "rejected", notes: "late" })).status).toBe(422);
  });

  test("payment cancellation then retry creates a fresh pending payment", async () => {
    const { token: adminToken } = await seedAdmin();
    const { propertyId } = await listedProperty(adminToken);
    const buyer = await otpLogin();
    const { dealId } = await openDeal(buyer, propertyId, adminToken);
    const tokenAmount = await tokenAmountSetting();
    const first = expectStatus(await api("post", "/payments/token", buyer.token).send({ dealId, amount: tokenAmount }), 201, "first");
    expectStatus(await api("post", `/payments/${first.body.data._id}/cancel`, buyer.token).send({}), 200, "cancel");
    expect((await find("payments", first.body.data._id)).status).toBe("cancelled");
    const retry = expectStatus(await api("post", "/payments/token", buyer.token).send({ dealId, amount: tokenAmount }), 201, "retry");
    expect(retry.body.data._id).not.toBe(first.body.data._id);
    expect((await find("payments", retry.body.data._id)).status).toBe("pending");
  });

  test("rejection requires a reason and leaves the deal unpaid", async () => {
    const { token: adminToken } = await seedAdmin();
    const { propertyId } = await listedProperty(adminToken);
    const buyer = await otpLogin();
    const { dealId } = await openDeal(buyer, propertyId, adminToken);
    const pay = expectStatus(await api("post", "/payments/token", buyer.token).send({ dealId, amount: await tokenAmountSetting() }), 201, "token");
    expect((await api("patch", `/admin/payments/${pay.body.data._id}/verify`, adminToken).send({ decision: "rejected" })).status).toBe(422);
    expectStatus(await api("patch", `/admin/payments/${pay.body.data._id}/verify`, adminToken).send({ decision: "rejected", notes: "UTR not found" }), 200, "reject");
    const deal = await find("salesdeals", dealId);
    expect(deal.financials?.tokenPaid ?? false).toBe(false);
    expect((await find("properties", propertyId)).status).toBe("available");
  });
});

describe("Lost deal releases only its own reservation", () => {
  test("an unpaid deal can be marked lost and does not create a refund", async () => {
    const { token: adminToken } = await seedAdmin();
    const { propertyId } = await listedProperty(adminToken);
    const buyer = await otpLogin();
    const { dealId } = await openDeal(buyer, propertyId, adminToken);
    const lost = await api("patch", `/admin/sales/deals/${dealId}/lost`, adminToken).send({ lostReason: "Buyer withdrew" });
    expectStatus(lost, 200, "lost-unpaid");
    expect((await find("salesdeals", dealId)).stage).toBe("lost");
    expect((await find("properties", propertyId)).status).toBe("available");
    expect(await col("payments").countDocuments({ dealId: oid(dealId), type: "refund" })).toBe(0);
  });

  test("a paid token stays paid, the property returns to the catalogue, and a second lost call conflicts", async () => {
    const { token: adminToken } = await seedAdmin();
    const { propertyId } = await listedProperty(adminToken);
    const buyer = await otpLogin();
    const { dealId } = await openDeal(buyer, propertyId, adminToken);
    const pay = expectStatus(await api("post", "/payments/token", buyer.token).send({ dealId, amount: await tokenAmountSetting() }), 201, "token");
    expectStatus(await api("patch", `/admin/payments/${pay.body.data._id}/verify`, adminToken).send({ decision: "paid" }), 200, "verify");
    const [first, second] = await Promise.all([
      api("patch", `/admin/sales/deals/${dealId}/lost`, adminToken).send({ lostReason: "Buyer withdrew" }),
      api("patch", `/admin/sales/deals/${dealId}/lost`, adminToken).send({ lostReason: "Buyer withdrew" })
    ]);
    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([200, 409]);
    expect((await find("salesdeals", dealId)).stage).toBe("lost");
    const property = await find("properties", propertyId);
    expect(property.status).toBe("available");
    expect(property.reservedByDealId || null).toBeFalsy();
    expect((await find("payments", pay.body.data._id)).status).toBe("paid");
    expect(await col("payments").countDocuments({ dealId: oid(dealId), type: "refund" })).toBe(0);
    const catalog = expectStatus(await api("get", "/properties?limit=100"), 200, "catalog");
    expect(catalog.body.data.some((row) => String(row._id || row.id) === propertyId)).toBe(true);
  });
});

describe("Verified refund records", () => {
  test("a refund requires a transfer reference, is stored once, and retries do not duplicate it", async () => {
    const { token: adminToken } = await seedAdmin();
    const { propertyId } = await listedProperty(adminToken);
    const buyer = await otpLogin();
    const { dealId } = await openDeal(buyer, propertyId, adminToken);
    const pay = expectStatus(await api("post", "/payments/token", buyer.token).send({ dealId, amount: await tokenAmountSetting() }), 201, "token");
    expectStatus(await api("patch", `/admin/payments/${pay.body.data._id}/verify`, adminToken).send({ decision: "paid" }), 200, "verify");
    const missing = await api("post", `/admin/payments/${pay.body.data._id}/refund`, adminToken).send({});
    expect(missing.status).toBeGreaterThanOrEqual(400);
    expect(missing.status).toBeLessThan(500);
    const recorded = expectStatus(await api("post", `/admin/payments/${pay.body.data._id}/refund`, adminToken).send({ transactionReference: "UTR-REFUND-1001", notes: "Returned to the buyer account" }), 200, "refund");
    expect(recorded.body.data.type).toBe("refund");
    expect(recorded.body.data.status).toBe("refunded");
    expect(recorded.body.data.transactionReference).toBe("UTR-REFUND-1001");
    expect((await find("payments", pay.body.data._id)).status).toBe("refunded");
    const again = expectStatus(await api("post", `/admin/payments/${pay.body.data._id}/refund`, adminToken).send({ transactionReference: "UTR-REFUND-1001" }), 200, "refund-retry");
    expect(String(again.body.data._id || again.body.data.id)).toBe(String(recorded.body.data._id || recorded.body.data.id));
    const [raceA, raceB] = await Promise.all([
      api("post", `/admin/payments/${pay.body.data._id}/refund`, adminToken).send({ transactionReference: "UTR-REFUND-RACE" }),
      api("post", `/admin/payments/${pay.body.data._id}/refund`, adminToken).send({ transactionReference: "UTR-REFUND-RACE" })
    ]);
    expect([raceA.status, raceB.status].every((status) => status === 200)).toBe(true);
    expect(await col("payments").countDocuments({ refundOfPaymentId: oid(pay.body.data._id), type: "refund" })).toBe(1);
  });
});

describe("Token coupons", () => {
  test("a token coupon reduces the payable amount once and a non-token coupon is rejected", async () => {
    const { token: adminToken } = await seedAdmin();
    const settings = expectStatus(await api("patch", "/admin/settings", adminToken).send({
      tools: {
        coupons: [
          {
            id: "qa-first10",
            code: "FIRST10",
            discount: "10%",
            type: "% discount",
            appliesTo: "Boost plans",
            uses: "0/100 uses",
            expiry: "31 Dec 2028",
            active: true
          },
          {
            id: "qa-token10",
            code: "TOKEN10",
            discount: "10%",
            type: "% discount",
            appliesTo: "Token payment",
            uses: "0/2 uses",
            expiry: "31 Dec 2028",
            active: true
          }
        ]
      }
    }), 200, "settings");
    expect(settings.status).toBe(200);
    const amount = Math.round((await tokenAmountSetting()) * 0.9);
    const { propertyId } = await listedProperty(adminToken);
    const buyer = await otpLogin();
    const { dealId } = await openDeal(buyer, propertyId, adminToken);
    const rejected = await api("post", "/payments/token", buyer.token).send({ dealId, amount, couponCode: "FIRST10" });
    expect(rejected.status).toBeGreaterThanOrEqual(400);
    const paid = expectStatus(await api("post", "/payments/token", buyer.token).send({ dealId, amount, method: "upi", transactionReference: "UPI-COUPON", couponCode: "TOKEN10" }), 201, "coupon-token");
    expect(paid.body.data.amount).toBe(amount);
    expect(String(paid.body.data.couponCode)).toBe("TOKEN10");
    const { propertyId: otherPropertyId } = await listedProperty(adminToken);
    const { dealId: otherDealId } = await openDeal(buyer, otherPropertyId, adminToken);
    const duplicate = await api("post", "/payments/token", buyer.token).send({ dealId: otherDealId, amount, couponCode: "TOKEN10" });
    expect(duplicate.status).toBeGreaterThanOrEqual(400);
    expect(await col("payments").countDocuments({ couponCode: "TOKEN10" })).toBe(1);
  });
});

describe("Sell request input handling", () => {
  test("QA-BUG-007a negotiable: 'false' (string) is stored as false", async () => {
    const seller = await otpLogin();
    const sell = expectStatus(await api("post", "/sell-requests", seller.token).send(sellPayload({ negotiable: "false" })), [200, 201], "sell");
    expect((await find("sellrequests", sell.body.data._id)).negotiable).toBe(false);
  });

  test("QA-BUG-007b loanOnProperty: 'false' (string) is accepted without loan details", async () => {
    const seller = await otpLogin();
    const res = await api("post", "/sell-requests", seller.token).send(sellPayload({ loanOnProperty: "false" }));
    expectStatus(res, [200, 201], "sell-loan-false");
    expect((await find("sellrequests", res.body.data._id)).loanOnProperty).toBe(false);
  });

  test("boundary: askingPrice below 50,000 and above 5e10 rejected; bad pincode rejected", async () => {
    const seller = await otpLogin();
    for (const askingPrice of [49999, 50000000001]) expect((await api("post", "/sell-requests", seller.token).send(sellPayload({ askingPrice }))).status).toBe(400);
    expect((await api("post", "/sell-requests", seller.token).send(sellPayload({ address: { pincode: "12345" } }))).status).toBe(400);
    expect([200, 201]).toContain((await api("post", "/sell-requests", seller.token).send(sellPayload({ askingPrice: 50000 }))).status);
  });

  test("a seller cannot read or edit another seller's sell request", async () => {
    const a = await otpLogin();
    const b = await otpLogin();
    const sell = expectStatus(await api("post", "/sell-requests", a.token).send(sellPayload()), [200, 201], "sell");
    const id = sell.body.data._id;
    expect((await api("get", `/me/sell-requests/${id}`, b.token)).status).toBe(404);
    const hijack = await api("patch", `/me/sell-requests/${id}`, b.token).send({ propertyTitle: "hijack" });
    console.log("QA_HIJACK " + JSON.stringify({ status: hijack.status, error: hijack.body.error }));
    expect([403, 404, 422]).toContain(hijack.status);
    expect((await find("sellrequests", id)).propertyTitle).toBe("QA Lifecycle Plot");
  });
});

describe("Acquisition gates (positive rules work)", () => {
  test("each gate blocks when its data is missing", async () => {
    const { token: adminToken } = await seedAdmin();
    const { acqId } = await newAcquisitionFromSell(adminToken);
    const s = (body) => api("patch", `/admin/acquisitions/${acqId}/stage`, adminToken).send(body);
    expectStatus(await s({ stage: "site_inspection" }), 200, "si");
    expectStatus(await s({ stage: "valuation" }), 200, "val");
    expect((await s({ stage: "negotiation" })).status).toBe(422); // valuation amount required
    expectStatus(await s({ stage: "negotiation", valuation: { amount: 2000000 } }), 200, "neg");
    expect((await s({ stage: "token_to_seller" })).status).toBe(422); // agreed price required
    expectStatus(await s({ stage: "token_to_seller", negotiation: { agreedPrice: 2100000 } }), 200, "tok");
    expect((await s({ stage: "documentation" })).status).toBe(422); // token paid required
    expectStatus(await s({ stage: "documentation", token: { paid: true, amount: 50000 } }), 200, "doc");
    expect((await s({ stage: "seller_payout", documentation: { ownership_verified: true } })).status).toBe(422); // full legal checklist
    expectStatus(await s({ stage: "seller_payout", documentation: LEGAL_DOCUMENTATION }), 200, "payout");
    expect((await s({ stage: "acquired" })).status).toBe(422); // payout completion required
    expect((await s({ stage: "pending_review" })).status).toBe(409); // illegal backwards transition
    expect((await api("post", `/admin/acquisitions/${acqId}/convert-to-property`, adminToken).send({})).status).toBe(422); // not acquired yet
  });
});
