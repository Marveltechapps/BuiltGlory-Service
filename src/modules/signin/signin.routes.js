import { Router } from "express";
import { controller } from "./signin.controller.js";
import { validate } from "../../middleware/validate.js";
import { otpLimiter } from "../../middleware/rateLimit.js";
import { resendOtpValidator, sendOtpValidator, verifyOtpValidator } from "./signin.validation.js";

const router = Router();

router.post("/send-otp", otpLimiter, validate(sendOtpValidator), controller.sendOtp);
router.post("/verify-otp", otpLimiter, validate(verifyOtpValidator), controller.verifyOtp);
router.post("/resend-otp", otpLimiter, validate(resendOtpValidator), controller.resendOtp);

export default router;
