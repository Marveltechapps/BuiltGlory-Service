import { getRedis } from "../../config/redis.js";
import { sendCustomerOtp, verifyCustomerOtp } from "../auth/auth.service.js";

const localPhone = (mobileNumber, phone) => String(mobileNumber || phone || "").replace(/\D/g, "").slice(-10);

/**
 * Legacy `/api/signin` delegates to the current OTP service.
 * The code stays in Redis for a few minutes. The access token uses the normal customer lifetime.
 */
export const sendOtp = async ({ mobileNumber, phone, countryCode, deviceId, ip }) => {
  await sendCustomerOtp({
    countryCode: countryCode || "+91",
    phone: localPhone(mobileNumber, phone),
    deviceId,
    ip,
    purpose: "login"
  });
  return { message: "OTP sent successfully" };
};

export const verifyOtp = async ({ mobileNumber, phone, otp, enteredOTP, countryCode, deviceId, userAgent, ip }) => {
  const local = localPhone(mobileNumber, phone);
  const session = await verifyCustomerOtp({
    countryCode: countryCode || "+91",
    phone: local,
    otp: String(otp ?? enteredOTP ?? ""),
    deviceId,
    userAgent,
    ip,
    purpose: "login"
  });
  const user = session.user;
  return {
    message: "OTP verified successfully",
    userId: String(user._id || user.id),
    token: session.accessToken,
    isVerified: true,
    name: user.name || null
  };
};

export const resendOtp = async ({ mobileNumber, phone, countryCode, deviceId, ip }) => {
  const local = localPhone(mobileNumber, phone);
  const phoneNormalized = `${String(countryCode || "+91").replace(/\D/g, "")}${local}`;
  await getRedis().del(`otp:cooldown:${phoneNormalized}:${deviceId || ip || "unknown"}`);
  await sendCustomerOtp({
    countryCode: countryCode || "+91",
    phone: local,
    deviceId,
    ip,
    purpose: "login"
  });
  return { message: "OTP resent successfully" };
};
