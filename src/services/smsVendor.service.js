import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { AppError } from "../modules/error/index.js";

const DEFAULT_OTP_TEMPLATE =
  // Replace via SMS_OTP_MESSAGE_TEMPLATE with BuiltGlory's DLT-approved text for sender EVOLGN.
  "Dear Applicant, Your OTP for Mobile No. Verification is {otp}. BuiltGlory - EVOLGN";

const resolveSmsVendorUrl = () => String(env.SMS_VENDOR_URL || env.SMS_PROVIDER_URL || "").trim();

export const buildOtpSmsMessage = (otp) => {
  const template = String(env.SMS_OTP_MESSAGE_TEMPLATE || DEFAULT_OTP_TEMPLATE);
  return template.includes("{otp}") ? template.replaceAll("{otp}", String(otp)) : `${template} ${otp}`;
};

const parseGatewayResponse = (text) => {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { raw: text };
  }
};

const isSuccessResponse = (data) => {
  const status = String(data.status || data.Status || data.STATUS || "").toLowerCase();
  if (["success", "sent", "submitted", "ok"].includes(status)) return true;
  if (typeof data.raw === "string" && /\b(success|sent|submitted)\b/i.test(data.raw)) return true;
  return false;
};

const providerMessage = (data) => {
  const message = data.Message || data.message || data.error || data.Error || data.raw;
  return typeof message === "string" && message.trim() ? message.trim() : null;
};

const mapSmsProviderError = (data, httpStatus) => {
  const message = (providerMessage(data) || "").toLowerCase();
  const statusId = String(data.status_id || data.statusId || data.code || "").toLowerCase();

  if (
    statusId.includes("1008")
    || message.includes("insufficient sms credits")
    || message.includes("insufficient credit")
    || message.includes("low balance")
    || message.includes("no credits")
  ) {
    return new AppError(
      503,
      "SMS_CREDITS_EXHAUSTED",
      "SMS provider has insufficient credits. Please recharge the SMS account or contact support."
    );
  }

  if (
    message.includes("invalid user")
    || message.includes("authentication")
    || message.includes("unauthorized")
    || message.includes("invalid password")
    || statusId.includes("auth")
  ) {
    return new AppError(
      502,
      "SMS_PROVIDER_AUTH_FAILED",
      "SMS provider authentication failed. Check SMS vendor credentials."
    );
  }

  if (
    message.includes("invalid mobile")
    || message.includes("invalid number")
    || message.includes("invalid phone")
    || statusId.includes("invalid_mobile")
  ) {
    return new AppError(
      400,
      "SMS_INVALID_MOBILE",
      "SMS provider rejected this phone number. Please check the number and try again."
    );
  }

  return new AppError(
    httpStatus >= 400 && httpStatus < 500 ? httpStatus : 502,
    "SMS_DELIVERY_FAILED",
    providerMessage(data) || "Failed to send OTP via SMS. Please try again shortly."
  );
};

const deliverViaVendor = async ({ mobileNumber, otp }) => {
  const vendorUrl = resolveSmsVendorUrl();
  if (!vendorUrl) {
    throw new AppError(500, "SMS_CONFIG_MISSING", "SMS vendor is not configured. Set SMS_VENDOR_URL.");
  }

  const url = `${vendorUrl}to_mobileno=${encodeURIComponent(mobileNumber)}&sms_text=${encodeURIComponent(buildOtpSmsMessage(otp))}`;
  logger.info({
    event: "sms_otp_vendor_request",
    mobileNumber,
    vendorHost: (() => {
      try {
        return new URL(vendorUrl).host;
      } catch {
        return "invalid-url";
      }
    })()
  });

  let response;
  try {
    response = await fetch(url);
  } catch (error) {
    logger.error({
      event: "sms_otp_vendor_network_error",
      mobileNumber,
      error: error.message
    });
    throw new AppError(502, "SMS_PROVIDER_UNAVAILABLE", "Could not reach the SMS provider. Please try again shortly.");
  }

  const rawText = await response.text();
  const data = parseGatewayResponse(rawText);
  logger.info({
    event: "sms_otp_vendor_response",
    mobileNumber,
    httpStatus: response.status,
    providerStatus: data.status || data.Status || null,
    providerStatusId: data.status_id || data.statusId || null,
    providerMessage: providerMessage(data)
  });

  if (!response.ok || !isSuccessResponse(data)) {
    throw mapSmsProviderError(data, response.status);
  }

  return data;
};

const deliverViaLog = async ({ mobileNumber, otp }) => {
  if (env.NODE_ENV === "production") {
    throw new AppError(500, "SMS_LOG_MODE_FORBIDDEN", "SMS log delivery mode is not allowed in production.");
  }
  logger.warn({
    event: "sms_otp_log_delivery",
    mobileNumber,
    otp,
    message: "SMS_DELIVERY_MODE=log — OTP logged for non-production testing only."
  });
  return { status: "success", deliveryMode: "log", mobileNumber };
};

export const sendOtpViaSmsVendor = async ({ mobileNumber, otp }) => {
  const mode = String(env.SMS_DELIVERY_MODE || "vendor").toLowerCase();
  if (mode === "log") return deliverViaLog({ mobileNumber, otp });
  if (mode !== "vendor") {
    throw new AppError(500, "SMS_CONFIG_INVALID", `Unsupported SMS_DELIVERY_MODE "${mode}". Use "vendor" or "log".`);
  }
  return deliverViaVendor({ mobileNumber, otp });
};
