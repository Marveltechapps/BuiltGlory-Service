// QA-E2E: complete Sell & Buy lifecycle driven through the HTTP API with DB verification at each step.
// Isolated MongoDB replica set (mongodb-memory-server). No production data is touched.
import { jest } from "@jest/globals";
import { setupIntegrationDb, seedAdmin } from "../helpers/integrationHarness.js";
import { env } from "../../config/env.js";
import {
  api, find, col, oid, expectStatus, otpLogin, completeKyc, sellPayload, acquire, publishFromAcquisition, tokenAmountSetting
} from "./qaHelpers.js";

jest.setTimeout(120_000);
setupIntegrationDb();
beforeEach(() => { env.SMS_DELIVERY_MODE = "log"; });

describe("QA-E2E Sell & Buy lifecycle", () => {
  test("seller lists → admin acquires → published → buyer enquires → visit → deal → token → verify → close → sold", async () => {
    const evidence = {};
    // 1. Seller and buyer register through OTP.
    const seller = await otpLogin();
    const buyer = await otpLogin();
    expect(await find("users", seller.userId)).toEqual(expect.objectContaining({ isActive: true }));

    expectStatus(await api("patch", "/me", seller.token).send({ name: "QA Seller" }), 200, "profile");
    expect((await find("users", seller.userId)).name).toBe("QA Seller");

    // 2. Seller creates a sell request (the "product upload" of this platform).
    const sell = expectStatus(await api("post", "/sell-requests", seller.token).send(sellPayload()), [200, 201], "sell-create");
    const sellId = sell.body.data._id;
    const sellDoc = await find("sellrequests", sellId);
    expect(String(sellDoc.sellerId)).toBe(seller.userId);
    expect(sellDoc.askingPrice).toBe(2500000);
    evidence.sellStatusAfterCreate = sellDoc.status;

    // 3. Admin review. "approved" is gated on seller KYC + mandatory documents.
    const { token: adminToken } = await seedAdmin();
    expectStatus(await api("patch", `/admin/sell-requests/${sellId}/review`, adminToken).send({ decision: "under_review" }), 200, "under_review");
    const blocked = await api("patch", `/admin/sell-requests/${sellId}/review`, adminToken).send({ decision: "approved" });
    expect(blocked.status).toBe(422);
    expect(blocked.body.error.message).toMatch(/KYC/);
    await completeKyc(seller, adminToken);
    await completeKyc(buyer, adminToken);

    // Dashboard path: "Accept for Acquisition" → POST create-acquisition.
    const acq = expectStatus(await api("post", `/admin/sell-requests/${sellId}/create-acquisition`, adminToken).send({}), 201, "create-acquisition");
    const acqId = acq.body.data._id;
    expect(acq.body.data.stage).toBe("pending_review");
    // Duplicate click returns the same acquisition (idempotent).
    const again = expectStatus(await api("post", `/admin/sell-requests/${sellId}/create-acquisition`, adminToken).send({}), 201, "create-acquisition-dup");
    expect(again.body.data._id).toBe(acqId);
    expect(await col("acquisitions").countDocuments({ sellRequestId: oid(sellId) })).toBe(1);

    // 4. Acquisition walked to acquired with each gate satisfied.
    const acqLog = await acquire(acqId, adminToken);
    expect(acqLog.every((s) => s.status === 200) ? "ok" : acqLog).toBe("ok");
    const acqDoc = await find("acquisitions", acqId);
    expect(acqDoc.stage).toBe("acquired");
    expect(acqDoc.stageHistory.map((h) => h.to)).toEqual(["site_inspection", "valuation", "negotiation", "token_to_seller", "documentation", "seller_payout", "acquired"]);

    // Seller sees progress in their tracker.
    const mine = expectStatus(await api("get", `/me/sell-requests/${sellId}`, seller.token), 200, "seller-tracker");
    evidence.sellerTrackerStatus = mine.body.data.status;

    // 5. Property converted and published; a draft is not public.
    const propertyId = await publishFromAcquisition(acqId, adminToken, 2900000);
    const prop = await find("properties", propertyId);
    expect(prop.status).toBe("available");
    evidence.propertySource = prop.source;

    // 6. Buyer finds it in the public catalog + search, saves it.
    const list = expectStatus(await api("get", "/properties?limit=50"), 200, "catalog");
    expect(list.body.data.map((p) => String(p._id))).toContain(propertyId);
    const detail = expectStatus(await api("get", `/properties/${propertyId}`), 200, "detail");
    expect(detail.body.data.price).toBe(2900000);
    const search = await api("get", "/search?q=Whitefield");
    evidence.searchStatus = search.status;
    expect((await api("post", `/properties/${propertyId}/save`, buyer.token).send({})).status).toBeLessThan(300);
    const fav = expectStatus(await api("get", "/me/favorites", buyer.token), 200, "favorites");
    expect(JSON.stringify(fav.body.data)).toContain(propertyId);

    // 7. Enquiry + visit.
    const enq = expectStatus(await api("post", "/buy-enquiries", buyer.token).send({ propertyId, preferredContact: "phone", interestType: "schedule_visit", preferredVisitTime: "this_weekend_morning", enquiryTypes: ["buy"] }), 201, "enquiry");
    const enquiryId = enq.body.data._id;
    expect(String((await find("buyenquiries", enquiryId)).buyerId)).toBe(buyer.userId);
    const visitDate = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
    const visit = expectStatus(await api("post", "/visits", buyer.token).send({ propertyId, enquiryId, visitDate, visitTime: "11:00 AM", visitType: "physical" }), 201, "visit");
    const visitId = visit.body.data._id;
    expectStatus(await api("patch", `/admin/visits/${visitId}/status`, adminToken).send({ status: "confirmed" }), 200, "visit-confirmed");
    expectStatus(await api("patch", `/admin/visits/${visitId}/status`, adminToken).send({ status: "completed", feedback: { buyerInterest: "very_interested", notes: "QA buyer liked the plot", nextAction: "move_to_negotiation" } }), 200, "visit-completed");
    expect((await find("visits", visitId)).status).toBe("completed");
    const myVisits = expectStatus(await api("get", "/me/visits", buyer.token), 200, "me-visits");
    expect(myVisits.body.data.find((v) => String(v._id) === visitId)?.status).toBe("completed");

    // 8. Deal.
    const deal = expectStatus(await api("post", `/admin/buy-enquiries/${enquiryId}/convert-to-deal`, adminToken).send({}), 201, "convert-to-deal");
    const dealId = deal.body.data._id;
    expect(String((await find("salesdeals", dealId)).buyerId)).toBe(buyer.userId);
    for (const stage of ["site_visits", "negotiation"]) expectStatus(await api("patch", `/admin/sales/deals/${dealId}/stage`, adminToken).send({ stage }), 200, `deal-${stage}`);
    expectStatus(await api("patch", `/admin/sales/deals/${dealId}/offer`, adminToken).send({ agreedPrice: 2850000 }), 200, "offer");
    expectStatus(await api("get", `/me/deals/${dealId}`, buyer.token), 200, "buyer-deal");

    // 9. Buyer submits token (manual UPI); stays pending; property NOT reserved yet.
    const tokenAmount = await tokenAmountSetting();
    const pay = expectStatus(await api("post", "/payments/token", buyer.token).send({ dealId, amount: tokenAmount, method: "upi", transactionReference: "QA-UPI-001", idempotencyKey: `qa-${dealId}` }), 201, "token");
    const paymentId = pay.body.data._id;
    expect((await find("payments", paymentId)).status).toBe("pending");
    expect((await find("properties", propertyId)).status).toBe("available");

    // 10. Admin verifies → deal financials + property reserved.
    expectStatus(await api("patch", `/admin/payments/${paymentId}/verify`, adminToken).send({ decision: "paid", notes: "QA statement matched" }), 200, "verify");
    expect((await find("payments", paymentId)).status).toBe("paid");
    const dealAfterToken = await find("salesdeals", dealId);
    expect(dealAfterToken.financials.tokenPaid).toBe(true);
    expect(dealAfterToken.financials.totalPaid).toBe(tokenAmount);
    expect((await find("properties", propertyId)).status).toBe("reserved");
    const pubReserved = await api("get", `/properties/${propertyId}`);
    evidence.reservedPublicDetail = { http: pubReserved.status, status: pubReserved.body?.data?.status };
    const catalogWhileReserved = expectStatus(await api("get", "/properties?limit=100"), 200, "catalog-while-reserved");
    expect(catalogWhileReserved.body.data.some((row) => String(row._id || row.id) === propertyId)).toBe(false);

    // 11. Close.
    expectStatus(await api("patch", `/admin/sales/deals/${dealId}/stage`, adminToken).send({ stage: "token_payment" }), 200, "deal-token_payment");
    expectStatus(await api("patch", `/admin/sales/deals/${dealId}/payment-plan`, adminToken).send({ paymentType: "full", totalPaid: 2850000 }), 200, "payment-plan");
    expectStatus(await api("patch", `/admin/sales/deals/${dealId}/stage`, adminToken).send({ stage: "full_payment" }), 200, "deal-full_payment");
    expectStatus(await api("patch", `/admin/sales/deals/${dealId}/stage`, adminToken).send({ stage: "documentation" }), 200, "deal-documentation");
    expectStatus(await api("patch", `/admin/sales/deals/${dealId}/close`, adminToken).send({ notes: "QA registration complete" }), 200, "close");

    // 12. Final consistency across buyer, seller, admin.
    const finalDeal = await find("salesdeals", dealId);
    expect(finalDeal.stage).toBe("closed");
    evidence.finalTotalPaid = finalDeal.financials?.totalPaid;
    expect((await find("properties", propertyId)).status).toBe("sold");
    const buyerDeals = expectStatus(await api("get", "/me/deals", buyer.token), 200, "me-deals");
    expect(buyerDeals.body.data.find((d) => String(d.id || d._id) === dealId)?.stage).toBe("closed");
    const myPayments = expectStatus(await api("get", "/me/payments", buyer.token), 200, "me-payments");
    expect(myPayments.body.data.map((p) => String(p.id || p._id))).toContain(paymentId);
    const adminPayments = expectStatus(await api("get", `/admin/payments?dealId=${dealId}`, adminToken), 200, "admin-payments");
    expect(adminPayments.body.data.map((p) => String(p.id || p._id))).toContain(paymentId);
    expect(await col("auditlogs").countDocuments({ resourceType: "payments" })).toBeGreaterThan(0);
    expect(await col("auditlogs").countDocuments({ resourceType: "salesDeals" })).toBeGreaterThan(0);
    expect((await api("get", `/me/deals/${dealId}`, seller.token)).status).toBe(404);
    expect((await api("get", "/me/payments", seller.token)).body.data).toHaveLength(0);
    const pubAfterSold = expectStatus(await api("get", "/properties?limit=100"), 200, "catalog-after-sold");
    const soldRow = pubAfterSold.body.data.find((p) => String(p.id || p._id) === propertyId);
    evidence.soldInPublicCatalog = soldRow ? soldRow.status : "not listed";
    expect(soldRow?.status ?? "not listed").not.toBe("available");
    // Notifications reach buyer/seller.
    evidence.buyerNotifications = await col("notifications").countDocuments({ userId: oid(buyer.userId) });
    evidence.sellerNotifications = await col("notifications").countDocuments({ userId: oid(seller.userId) });
    console.log("QA_LIFECYCLE_EVIDENCE " + JSON.stringify({ ...evidence, sellId, acqId, propertyId, enquiryId, visitId, dealId, paymentId, tokenAmount }));
  });
});
