import { Router } from "express";
import { controller } from "./auth.controller.js";
import { validateZod } from "../../middleware/validateZod.js";
import { authenticate } from "../../middleware/auth.js";
import { authLimiter, emailOtpLimiter, otpLimiter, refreshLimiter } from "../../middleware/rateLimit.js";
import {
  sendOtpSchema,
  verifyOtpSchema,
  adminLoginSchema,
  refreshSchema,
  passwordLoginSchema,
  setPasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  sendEmailOtpSchema,
  resendEmailOtpSchema,
  verifyEmailOtpSchema
} from "./auth.schemas.js";

const router = Router();
router.post("/auth/customer/otp/send", otpLimiter, validateZod(sendOtpSchema), controller.sendOtp);
router.post("/auth/customer/otp/verify", otpLimiter, validateZod(verifyOtpSchema), controller.verifyOtp);
router.post("/auth/customer/password/login", authLimiter, validateZod(passwordLoginSchema), controller.passwordLogin);
router.put("/me/password", authenticate("customer"), validateZod(setPasswordSchema), controller.setPassword);
router.post("/auth/customer/password/forgot", otpLimiter, validateZod(forgotPasswordSchema), controller.forgotPassword);
router.post("/auth/customer/password/reset", otpLimiter, validateZod(resetPasswordSchema), controller.resetPassword);
router.post("/auth/email/otp/send", emailOtpLimiter, validateZod(sendEmailOtpSchema), controller.sendEmailOtp);
router.post("/auth/email/otp/resend", emailOtpLimiter, validateZod(resendEmailOtpSchema), controller.resendEmailOtp);
router.post("/auth/email/otp/verify", emailOtpLimiter, validateZod(verifyEmailOtpSchema), controller.verifyEmailOtp);
router.post("/auth/admin/login", authLimiter, validateZod(adminLoginSchema), controller.adminLogin);
router.post("/auth/refresh", refreshLimiter, validateZod(refreshSchema), controller.refresh);
router.post("/auth/logout", authLimiter, validateZod(refreshSchema), controller.logout);
router.get("/admin/sessions", authenticate("admin"), controller.listAdminSessions);
router.delete("/admin/sessions/:sid", authenticate("admin"), controller.revokeAdminSession);
router.delete("/admin/sessions", authenticate("admin"), controller.revokeOtherAdminSessions);
export default router;
