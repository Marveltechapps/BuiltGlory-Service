import { z } from "zod";
import { countryCodeSchema, otp6Schema, phone10Schema } from "../../validators/common.schemas.js";

const otpPurpose = z.enum(["login", "change_phone", "password_reset"]).default("login");

export const sendOtpSchema = z.object({
  body: z.object({
    countryCode: countryCodeSchema,
    phone: phone10Schema,
    deviceId: z.string().nullish(),
    purpose: otpPurpose
  })
}).passthrough();

export const verifyOtpSchema = z.object({
  body: z.object({
    requestId: z.string().nullish(),
    countryCode: countryCodeSchema,
    phone: phone10Schema,
    otp: otp6Schema,
    purpose: otpPurpose
  })
}).passthrough();

export const passwordLoginSchema = z.object({
  body: z.object({
    identifier: z.string().trim().min(3).max(160),
    password: z.string().min(6).max(128)
  })
}).passthrough();

export const setPasswordSchema = z.object({
  body: z.object({
    password: z.string().min(8).max(128)
  })
}).passthrough();

export const forgotPasswordSchema = z.object({
  body: z.object({
    countryCode: countryCodeSchema,
    phone: phone10Schema,
    deviceId: z.string().nullish()
  })
}).passthrough();

export const resetPasswordSchema = z.object({
  body: z.object({
    countryCode: countryCodeSchema,
    phone: phone10Schema,
    otp: otp6Schema,
    requestId: z.string().nullish(),
    newPassword: z.string().min(8).max(128)
  })
}).passthrough();

export const adminLoginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8)
  })
}).passthrough();

export const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1)
  })
}).passthrough();

const email = z.string().trim().toLowerCase().email();

export const sendEmailOtpSchema = z.object({
  body: z.object({ email })
}).passthrough();

export const resendEmailOtpSchema = z.object({
  body: z.object({ email })
}).passthrough();

export const verifyEmailOtpSchema = z.object({
  body: z.object({
    email,
    otp: otp6Schema,
    requestId: z.string().trim().nullish()
  })
}).passthrough();
