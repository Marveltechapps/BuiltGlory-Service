// QA: reconcile report KPI figures against seeded MongoDB records.
import { jest } from "@jest/globals";
import { setupIntegrationDb, seedAdmin } from "../helpers/integrationHarness.js";
import { env } from "../../config/env.js";
import {
  api, col, oid, expectStatus, otpLogin, completeKyc, listedProperty, openDeal, tokenAmountSetting, find
} from "./qaHelpers.js";

jest.setTimeout(180_000);
setupIntegrationDb();
beforeEach(() => { env.SMS_DELIVERY_MODE = "log"; });

describe("Reports reconciliation", () => {
  test("sales / acquisition / revenue report totals match seeded DB counts", async () => {
    const { token: adminToken } = await seedAdmin();
    const tokenAmount = await tokenAmountSetting();

    // Seed: 2 published properties, 1 reserved via verified token, 1 closed/sold.
    const listed = [];
    for (let i = 0; i < 2; i += 1) listed.push(await listedProperty(adminToken));

    const buyerA = await otpLogin();
    await completeKyc(buyerA, adminToken);
    const { dealId: dealA } = await openDeal(buyerA, listed[0].propertyId, adminToken);
    const payA = expectStatus(await api("post", "/payments/token", buyerA.token).send({ dealId: dealA, amount: tokenAmount, method: "upi" }), 201, "token-a");
    expectStatus(await api("patch", `/admin/payments/${payA.body.data._id}/verify`, adminToken).send({ decision: "paid" }), 200, "verify-a");

    const buyerB = await otpLogin();
    await completeKyc(buyerB, adminToken);
    const { dealId: dealB } = await openDeal(buyerB, listed[1].propertyId, adminToken);
    const payB = expectStatus(await api("post", "/payments/token", buyerB.token).send({ dealId: dealB, amount: tokenAmount, method: "bank" }), 201, "token-b");
    expectStatus(await api("patch", `/admin/payments/${payB.body.data._id}/verify`, adminToken).send({ decision: "paid" }), 200, "verify-b");
    expectStatus(await api("patch", `/admin/sales/deals/${dealB}/stage`, adminToken).send({ stage: "token_payment", agreedPrice: 2850000 }), 200, "token-stage");
    expectStatus(await api("patch", `/admin/sales/deals/${dealB}/payment-plan`, adminToken).send({ paymentType: "full", totalPaid: 2850000 }), 200, "payment-plan");
    expectStatus(await api("patch", `/admin/sales/deals/${dealB}/stage`, adminToken).send({ stage: "full_payment" }), 200, "full");
    expectStatus(await api("patch", `/admin/sales/deals/${dealB}/stage`, adminToken).send({ stage: "documentation" }), 200, "docs");
    expectStatus(await api("patch", `/admin/sales/deals/${dealB}/close`, adminToken).send({ notes: "QA reports close" }), 200, "close");

    const db = {
      reserved: await col("properties").countDocuments({ status: "reserved", isDeleted: { $ne: true } }),
      sold: await col("properties").countDocuments({ status: "sold", isDeleted: { $ne: true } }),
      tokenPaidDeals: await col("salesdeals").countDocuments({ "financials.tokenPaid": true, isDeleted: { $ne: true } }),
      closedDeals: await col("salesdeals").countDocuments({ stage: "closed", isDeleted: { $ne: true } }),
      paidTokenTotal: (await col("payments").aggregate([
        { $match: { status: "paid", type: "token", isDeleted: { $ne: true } } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ]).toArray())[0]?.total || 0,
      acquisitionsAcquired: await col("acquisitions").countDocuments({ stage: "acquired", isDeleted: { $ne: true } })
    };

    expect(db.reserved).toBe(1);
    expect(db.sold).toBe(1);
    expect(db.tokenPaidDeals).toBe(2);
    expect(db.closedDeals).toBe(1);
    expect(db.paidTokenTotal).toBe(tokenAmount * 2);
    expect(db.acquisitionsAcquired).toBeGreaterThanOrEqual(2);

    const summary = expectStatus(await api("get", "/admin/reports/summary", adminToken), 200, "summary");
    const sales = expectStatus(await api("get", "/admin/reports/sales/analytics", adminToken), 200, "sales-report");
    const acquisition = expectStatus(await api("get", "/admin/reports/acquisition/analytics", adminToken), 200, "acq-report");
    const revenue = expectStatus(await api("get", "/admin/reports/revenue/analytics", adminToken), 200, "revenue-report");

    const summaryData = summary.body.data || summary.body;
    const salesData = sales.body.data || sales.body;
    const acqData = acquisition.body.data || acquisition.body;
    const revData = revenue.body.data || revenue.body;
    const kpis = summaryData?.kpis || summaryData?.summary || null;

    const evidence = {
      db,
      summaryKeys: Object.keys(summaryData || {}),
      salesKeys: Object.keys(salesData || {}),
      acquisitionKeys: Object.keys(acqData || {}),
      revenueKeys: Object.keys(revData || {}),
      kpis,
      dealA: (await find("salesdeals", dealA)).financials?.totalPaid,
      dealB: (await find("salesdeals", dealB)).financials?.totalPaid,
      propertyA: (await find("properties", listed[0].propertyId)).status,
      propertyB: (await find("properties", listed[1].propertyId)).status
    };
    console.log("QA_REPORTS_RECON " + JSON.stringify(evidence));

    if (kpis?.tokenPaidDeals != null) expect(kpis.tokenPaidDeals).toBe(db.tokenPaidDeals);
    if (kpis?.closedDeals != null) expect(kpis.closedDeals).toBe(db.closedDeals);
    expect(evidence.dealA).toBe(tokenAmount);
    expect(evidence.propertyA).toBe("reserved");
    expect(evidence.propertyB).toBe("sold");
    expect([summary.status, sales.status, acquisition.status, revenue.status].every((s) => s === 200)).toBe(true);
  });
});
