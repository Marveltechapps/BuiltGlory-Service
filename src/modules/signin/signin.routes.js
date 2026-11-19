import { Router } from "express";
import { controller } from "./signin.controller.js";
import { validateZod } from "../../middleware/validateZod.js";
import { otpLimiter } from "../../middleware/rateLimit.js";
import { env } from "../../config/env.js";
import { resendOtpSchema, sendOtpSchema, verifyOtpSchema } from "./signin.schemas.js";

const router = Router();

/**
 * OBS-06: Legacy /api/signin OTP surface. No first-party client calls these routes.
 * Kept for compatibility with older integrations and existing tests.
 * Disabled in production unless ENABLE_LEGACY_SIGNIN=true.
 */
const legacyEnabled =
  env.NODE_ENV !== "production" ||
  String(process.env.ENABLE_LEGACY_SIGNIN || "").toLowerCase() === "true";

const refuseIfDisabled = (req, res, next) => {
  if (!legacyEnabled) {
    return res.status(410).json({
      error: {
        code: "LEGACY_SIGNIN_DISABLED",
        message: "Legacy /api/signin OTP endpoints are disabled. Use /api/v1/auth/customer/otp/*."
      },
      meta: { requestId: res.locals.requestId }
    });
  }
  res.setHeader("Deprecation", "true");
  res.setHeader("Sunset", "Sat, 01 Aug 2026 00:00:00 GMT");
  return next();
};

router.post("/send-otp", refuseIfDisabled, otpLimiter, validateZod(sendOtpSchema), controller.sendOtp);
router.post("/verify-otp", refuseIfDisabled, otpLimiter, validateZod(verifyOtpSchema), controller.verifyOtp);
router.post("/resend-otp", refuseIfDisabled, otpLimiter, validateZod(resendOtpSchema), controller.resendOtp);

export default router;
