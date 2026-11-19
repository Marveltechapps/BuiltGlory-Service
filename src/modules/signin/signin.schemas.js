import { z } from "zod";

const mobileNumber = z.string().regex(/^(?!0{10}$)\d{10}$/);
const otp = z.string().regex(/^\d{6}$/);

const phoneBody = z
  .object({
    mobileNumber: mobileNumber.optional(),
    phone: mobileNumber.optional(),
    countryCode: z.string().default("+91"),
    deviceId: z.string().nullish()
  })
  .refine((b) => Boolean(b.mobileNumber || b.phone), {
    message: "mobileNumber or phone is required",
    path: ["mobileNumber"]
  });

export const sendOtpSchema = z.object({ body: phoneBody }).passthrough();
export const resendOtpSchema = z.object({ body: phoneBody }).passthrough();

export const verifyOtpSchema = z
  .object({
    body: z
      .object({
        mobileNumber: mobileNumber.optional(),
        phone: mobileNumber.optional(),
        otp: otp.optional(),
        enteredOTP: otp.optional()
      })
      .refine((b) => Boolean(b.mobileNumber || b.phone), {
        message: "mobileNumber or phone is required",
        path: ["mobileNumber"]
      })
      .refine((b) => Boolean(b.otp || b.enteredOTP), {
        message: "otp or enteredOTP is required",
        path: ["otp"]
      })
  })
  .passthrough();
