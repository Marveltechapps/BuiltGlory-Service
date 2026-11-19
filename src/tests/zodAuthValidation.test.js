import { describe, expect, it } from "@jest/globals";
import { sendOtpSchema, verifyOtpSchema, adminLoginSchema, passwordLoginSchema } from "../modules/auth/auth.schemas.js";

describe("Zod auth schemas", () => {
  it("accepts valid OTP send payload", () => {
    const parsed = sendOtpSchema.parse({
      body: { countryCode: "+91", phone: "9876543210", deviceId: "web-1", purpose: "login" }
    });
    expect(parsed.body.phone).toBe("9876543210");
    expect(parsed.body.purpose).toBe("login");
  });

  it("rejects short phone on OTP send", () => {
    expect(() =>
      sendOtpSchema.parse({ body: { phone: "123", purpose: "login" } })
    ).toThrow();
  });

  it("rejects non-6-digit OTP", () => {
    expect(() =>
      verifyOtpSchema.parse({
        body: { phone: "9876543210", otp: "12", purpose: "login" }
      })
    ).toThrow();
  });

  it("requires admin email and password min 8", () => {
    expect(() =>
      adminLoginSchema.parse({ body: { email: "a@b.com", password: "short" } })
    ).toThrow();
    const ok = adminLoginSchema.parse({
      body: { email: "admin@builtglory.com", password: "password1" }
    });
    expect(ok.body.email).toBe("admin@builtglory.com");
  });

  it("allows password login length 6+", () => {
    const ok = passwordLoginSchema.parse({
      body: { identifier: "9876543210", password: "abc123" }
    });
    expect(ok.body.password).toBe("abc123");
  });
});
