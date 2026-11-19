// QA: authentication, sessions, RBAC, data isolation and injection checks.
import { jest } from "@jest/globals";
import request from "supertest";
import { app, setupIntegrationDb, seedAdmin, bearer } from "../helpers/integrationHarness.js";
import { getRedis } from "../../config/redis.js";
import { env } from "../../config/env.js";
import { api, find, expectStatus, otpLogin, nextPhone, listedProperty, openDeal, tokenAmountSetting, completeKyc } from "./qaHelpers.js";

jest.setTimeout(180_000);
setupIntegrationDb();
beforeEach(() => { env.SMS_DELIVERY_MODE = "log"; });

const sendOtp = (phone) => request(app).post("/api/v1/auth/customer/otp/send").set("X-Device-Id", `qa-${phone}`).send({ phone, countryCode: "+91" });
const verifyOtp = (phone, otp, requestId) => request(app).post("/api/v1/auth/customer/otp/verify").send({ phone, countryCode: "+91", otp, requestId });
const otpOf = async (requestId) => (await getRedis().get(`otp:plain:${requestId}`)) || JSON.parse(await getRedis().get(`otp:${requestId}`))?.otp;
const wrong = (otp) => String((Number(otp) + 1) % 1000000).padStart(6, "0");

describe("OTP", () => {
  test("wrong OTP x OTP_MAX_ATTEMPTS sequentially locks the code; correct OTP is then refused", async () => {
    const phone = nextPhone();
    const send = expectStatus(await sendOtp(phone), 200, "send");
    const requestId = send.body.data.requestId;
    const otp = await otpOf(requestId);
    for (let i = 0; i < env.OTP_MAX_ATTEMPTS; i += 1) expect((await verifyOtp(phone, wrong(otp), requestId)).status).toBe(401);
    expect((await verifyOtp(phone, otp, requestId)).status).toBe(409);
  });

  test("parallel wrong guesses are all counted toward the lockout", async () => {
    const phone = nextPhone();
    const send = expectStatus(await sendOtp(phone), 200, "send");
    const requestId = send.body.data.requestId;
    const otp = await otpOf(requestId);
    const guesses = 20;
    await Promise.all(Array.from({ length: guesses }, () => verifyOtp(phone, wrong(otp), requestId)));
    const recorded = Number(await getRedis().get(`otp:attempts:${requestId}`)) || JSON.parse(await getRedis().get(`otp:${requestId}`) || "{}")?.attempts || 0;
    const final = await verifyOtp(phone, otp, requestId);
    expect({ guesses, recordedAttempts: recorded, correctOtpAfterBurst: final.status }).toEqual({
      guesses,
      recordedAttempts: expect.any(Number),
      correctOtpAfterBurst: 409
    });
    expect(recorded).toBeGreaterThanOrEqual(env.OTP_MAX_ATTEMPTS);
  });

  test("OTP is single use and expired/unknown request ids are rejected", async () => {
    const phone = nextPhone();
    const send = expectStatus(await sendOtp(phone), 200, "send");
    const requestId = send.body.data.requestId;
    const otp = await otpOf(requestId);
    expectStatus(await verifyOtp(phone, otp, requestId), 200, "first");
    expect((await verifyOtp(phone, otp, requestId)).status).toBe(401);
    expect((await verifyOtp(phone, "123456", "00000000-0000-0000-0000-000000000000")).status).toBe(401);
  });

  test("OTP for phone A cannot log in phone B", async () => {
    const a = nextPhone();
    const b = nextPhone();
    const sendA = expectStatus(await sendOtp(a), 200, "send-a");
    const otpA = await otpOf(sendA.body.data.requestId);
    expect((await verifyOtp(b, otpA, sendA.body.data.requestId)).status).toBe(401);
  });

  test("resend cooldown: immediate second send is throttled", async () => {
    const phone = nextPhone();
    expectStatus(await sendOtp(phone), 200, "send");
    const again = await sendOtp(phone);
    expect([429, 409, 422]).toContain(again.status);
  });

  test("malformed phone / OTP inputs are 400 not 500", async () => {
    for (const phone of ["", "12345", "abcdefghij", { $gt: "" }, "98765432101"]) {
      const r = await request(app).post("/api/v1/auth/customer/otp/send").send({ phone, countryCode: "+91" });
      expect(r.status).toBe(400);
    }
    expect((await verifyOtp("9876543210", { $ne: "x" })).status).toBe(400);
  });
});

describe("Sessions", () => {
  test("logout revokes the refresh token; refresh rotation rejects reuse", async () => {
    const c = await otpLogin();
    const r1 = expectStatus(await request(app).post("/api/v1/auth/refresh").send({ refreshToken: c.refreshToken }), 200, "refresh-1");
    const rotated = r1.body.data.refreshToken;
    const reuse = await request(app).post("/api/v1/auth/refresh").send({ refreshToken: c.refreshToken });
    expect({ rotated: rotated !== c.refreshToken, reuseStatus: reuse.status }).toEqual({ rotated: true, reuseStatus: expect.any(Number) });
    expect([401, 409]).toContain(reuse.status);
    expectStatus(await request(app).post("/api/v1/auth/logout").set("Authorization", bearer(r1.body.data.accessToken)).send({ refreshToken: rotated }), [200, 204], "logout");
    expect((await request(app).post("/api/v1/auth/refresh").send({ refreshToken: rotated })).status).toBe(401);
  });

  test("access token of a blocked customer is refused", async () => {
    const { token: adminToken } = await seedAdmin();
    const c = await otpLogin();
    expectStatus(await api("get", "/me", c.token), 200, "me");
    expectStatus(await api("patch", `/admin/users/${c.userId}/block`, adminToken).send({ isBlocked: true, blockedReason: "QA block" }), 200, "block");
    expect([401, 403]).toContain((await api("get", "/me", c.token)).status);
  });

  test("tampered / alg:none / expired-format tokens are refused", async () => {
    const c = await otpLogin();
    const [h, p] = c.token.split(".");
    const none = `${Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url")}.${p}.`;
    for (const t of [`${h}.${p}.AAAA`, none, "garbage", ""]) expect((await api("get", "/me", t)).status).toBe(401);
  });
});

describe("RBAC", () => {
  test("customer token on admin routes, admin token on customer routes", async () => {
    const c = await otpLogin();
    const { token: adminToken } = await seedAdmin();
    for (const p of ["/admin/payments", "/admin/users", "/admin/sales/deals", "/admin/properties", "/admin/sell-requests", "/admin/acquisitions"]) {
      expect([401, 403]).toContain((await api("get", p, c.token)).status);
    }
    for (const p of ["/me", "/me/deals", "/me/payments"]) expect([401, 403]).toContain((await api("get", p, adminToken)).status);
  });

  test("limited admin (enquiries.read only) cannot verify payments, publish property, or change KYC", async () => {
    const { token: full } = await seedAdmin();
    const { propertyId } = await listedProperty(full);
    const buyer = await otpLogin();
    const { dealId } = await openDeal(buyer, propertyId, full);
    const pay = expectStatus(await api("post", "/payments/token", buyer.token).send({ dealId, amount: await tokenAmountSetting() }), 201, "token");
    const { token: limited } = await seedAdmin({ email: "limited@builtglory.test", role: "operations", permissions: ["enquiries.read"] });
    const results = {
      verify: (await api("patch", `/admin/payments/${pay.body.data._id}/verify`, limited).send({ decision: "paid" })).status,
      publish: (await api("patch", `/admin/properties/${propertyId}/status`, limited).send({ status: "reserved" })).status,
      kyc: (await api("patch", `/admin/users/${buyer.userId}/kyc`, limited).send({ status: "verified" })).status,
      deals: (await api("get", "/admin/sales/deals", limited)).status,
      payments: (await api("get", "/admin/payments", limited)).status
    };
    expect(results).toEqual({ verify: 403, publish: 403, kyc: 403, deals: 403, payments: 403 });
    expect((await find("payments", pay.body.data._id)).status).toBe("pending");
  });

  test("inactive admin is refused", async () => {
    const { token } = await seedAdmin({ email: "inactive@builtglory.test", isActive: false });
    expect([401, 403]).toContain((await api("get", "/admin/users", token)).status);
  });
});

describe("Data isolation and injection", () => {
  test("customer lists contain only their own rows", async () => {
    const { token: adminToken } = await seedAdmin();
    const { propertyId } = await listedProperty(adminToken);
    const a = await otpLogin();
    const b = await otpLogin();
    await completeKyc(a, adminToken);
    await openDeal(a, propertyId, adminToken);
    for (const p of ["/me/buy-enquiries", "/me/deals", "/me/payments", "/me/visits", "/me/sell-requests"]) {
      const r = expectStatus(await api("get", p, b.token), 200, p);
      expect({ p, n: r.body.data.length }).toEqual({ p, n: 0 });
    }
  });

  test("operator injection in query and body is neutralised", async () => {
    const c = await otpLogin();
    const q = await request(app).get("/api/v1/properties?status[$ne]=sold&city[$gt]=");
    expect(q.status).toBeLessThan(500);
    const body = await api("patch", "/me", c.token).send({ name: "QA", $set: { isBlocked: true }, role: "admin", kycStatus: "verified" });
    const u = await find("users", c.userId);
    expect({ http: body.status < 500, isBlocked: u.isBlocked, kyc: u.kycStatus, role: u.role }).toEqual({ http: true, isBlocked: false, kyc: expect.not.stringMatching(/^verified$/), role: expect.not.stringMatching(/^admin$/) });
  });

  test("admin login: bad password and unknown email give the same generic error", async () => {
    await seedAdmin({ email: "known@builtglory.test", password: "Password123!" });
    const bad = await request(app).post("/api/v1/auth/admin/login").send({ email: "known@builtglory.test", password: "wrong-pass-1" });
    const unknown = await request(app).post("/api/v1/auth/admin/login").send({ email: "nobody@builtglory.test", password: "wrong-pass-1" });
    expect(bad.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(bad.body.error.message).toBe(unknown.body.error.message);
  });
});
