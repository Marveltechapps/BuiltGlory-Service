import { jest } from "@jest/globals";
import request from "supertest";
import { env } from "../config/env.js";
import { getRedis } from "../config/redis.js";
import { app, setupIntegrationDb } from "./helpers/integrationHarness.js";
import { User } from "../modules/users/users.model.js";

jest.setTimeout(60_000);

setupIntegrationDb();

const originalFetch = global.fetch;

beforeEach(() => {
  env.SMS_DELIVERY_MODE = "vendor";
});

afterEach(() => {
  global.fetch = originalFetch;
});

const otpFor = async (phone) => {
  const requestId = await getRedis().get(`otp:latest:91${phone}`);
  if (!requestId) return null;
  const plain = await getRedis().get(`otp:plain:${requestId}`);
  if (plain) return plain;
  const raw = await getRedis().get(`otp:${requestId}`);
  return raw ? JSON.parse(raw).otp : null;
};

describe("signin OTP workflow", () => {
  test("sends and verifies OTP for a mobile number", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      text: async () => JSON.stringify({ status: "success" })
    }));

    const send = await request(app).post("/api/signin/send-otp").send({ mobileNumber: "9876543210" });
    expect(send.status).toBe(200);
    expect(send.body.message).toBe("OTP sent successfully");
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("to_mobileno=9876543210"));

    const otp = await otpFor("9876543210");
    expect(otp).toMatch(/^\d{6}$/);
    expect(await User.findOne({ mobileNumber: "9876543210" })).toBeNull();

    const verify = await request(app).post("/api/signin/verify-otp").send({ mobileNumber: "9876543210", otp });
    expect(verify.status).toBe(200);
    const verifiedUser = await User.findOne({ mobileNumber: "9876543210" }).select("+otp +otpExpiry");
    expect(verify.body).toEqual(expect.objectContaining({
      message: "OTP verified successfully",
      userId: String(verifiedUser._id),
      isVerified: true,
      name: null
    }));
    expect(verify.body.token).toBeTruthy();
    expect(verifiedUser.otp).toBeFalsy();
    expect(verifiedUser.otpExpiry).toBeFalsy();
  });

  test("accepts existing auth payload with phone alias", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      text: async () => JSON.stringify({ status: "success" })
    }));

    const send = await request(app).post("/api/signin/send-otp").send({
      countryCode: "+91",
      phone: "6385404182",
      deviceId: "device_123"
    });
    expect(send.status).toBe(200);
    expect(send.body.message).toBe("OTP sent successfully");
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("to_mobileno=6385404182"));

    expect(await otpFor("6385404182")).toMatch(/^\d{6}$/);
    expect(await User.findOne({ mobileNumber: "6385404182" })).toBeNull();
  });

  test("accepts plain text success response from SMS gateway", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      text: async () => "Message submitted successfully"
    }));

    const send = await request(app).post("/api/signin/send-otp").send({ mobileNumber: "9876543212" });
    expect(send.status).toBe(200);

    expect(await otpFor("9876543212")).toMatch(/^\d{6}$/);
  });

  test("auth verify accepts OTP created by signin send", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      text: async () => JSON.stringify({ status: "success" })
    }));

    const send = await request(app).post("/api/signin/send-otp").send({ phone: "7418268091" });
    expect(send.status).toBe(200);

    const otp = await otpFor("7418268091");
    const verify = await request(app).post("/api/v1/auth/customer/otp/verify").send({
      requestId: "otp_req_actual_value_from_send_response",
      phone: "7418268091",
      otp
    });

    expect(verify.status).toBe(200);
    expect(verify.body.data.accessToken).toBeTruthy();
    const user = await User.findOne({ mobileNumber: "7418268091" });
    expect(verify.body.data.user._id).toBe(String(user._id));
  });

  test("does not save OTP when SMS gateway fails", async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      text: async () => JSON.stringify({ status: "failed" })
    }));

    const res = await request(app).post("/api/signin/send-otp").send({ mobileNumber: "9876543211" });
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe("SMS_DELIVERY_FAILED");
    expect(res.body.error.message).toMatch(/Failed to send OTP via SMS/);
    expect(res.body.error.details).toEqual([]);

    const user = await User.findOne({ mobileNumber: "9876543211" }).select("+otp +otpExpiry");
    expect(user).toBeNull();
    expect(await otpFor("9876543211")).toBeNull();
  });
});
