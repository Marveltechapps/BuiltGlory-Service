import dotenv from "dotenv";
import { z } from "zod";
import { assertProductionRedisUrl, resolveRedisConnection } from "./redisOptions.js";

// Production and staging receive variables from the host (systemd EnvironmentFile,
// container env, or the platform). Do not fill gaps from a local .env file.
const nodeEnvAtLoad = process.env.NODE_ENV;
if (nodeEnvAtLoad !== "production" && nodeEnvAtLoad !== "staging") {
  dotenv.config();
}

const emptyToUndefined = (v) => (v === "" || v === undefined || v === null ? undefined : v);

const boolFromEnv = z.preprocess((v) => {
  if (v === true || v === "true") return true;
  if (v === false || v === "false") return false;
  return v;
}, z.boolean());

const emailLoose = z.string().email();

const optionalBool = z.preprocess((value) => {
  if (value === "" || value === undefined || value === null) return undefined;
  if (value === true || value === "true" || value === "1") return true;
  if (value === false || value === "false" || value === "0") return false;
  return value;
}, z.boolean().optional());

const intFromEnv = (fallback, min, max) => z.preprocess(
  (value) => (value === "" || value === undefined || value === null ? undefined : value),
  z.coerce.number().int().min(min).max(max).default(fallback)
);

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "staging", "production"]).default("development"),
    PORT: z.coerce.number().default(5001),
    MONGODB_URI: z.preprocess(emptyToUndefined, z.string().optional()),
    MONGODB_DNS_SERVERS: z.string().default(""),
    JWT_SECRET: z.string().default(""),
    JWT_ACCESS_SECRET: z.string().default("dev-access-secret-change-before-production"),
    JWT_REFRESH_SECRET: z.string().default("dev-refresh-secret-change-before-production"),
    JWT_ISSUER: z.string().default("builtglory-api"),
    JWT_AUDIENCE: z.string().default("builtglory-clients"),
    JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
    JWT_REFRESH_EXPIRES_IN: z.string().default("30d"),
    ADMIN_INACTIVITY_SECONDS: z.coerce.number().default(1800),
    OTP_EXPIRES_SECONDS: z.coerce.number().default(300),
    OTP_RESEND_SECONDS: z.coerce.number().default(60),
    OTP_MAX_ATTEMPTS: z.coerce.number().default(5),
    WEBHOOK_TOLERANCE_SECONDS: z.coerce.number().default(300),
    REDIS_ENABLED: optionalBool,
    REDIS_URL: z.string().default(""),
    REDIS_HOST: z.string().default(""),
    REDIS_PORT: intFromEnv(6379, 1, 65535),
    REDIS_PASSWORD: z.string().default(""),
    REDIS_CONNECT_TIMEOUT_MS: intFromEnv(10_000, 200, 60_000),
    REDIS_MAX_RECONNECT_ATTEMPTS: intFromEnv(8, 1, 50),
    REDIS_RECONNECT_PROBE_MS: intFromEnv(15_000, 250, 120_000),
    /** When false, rediss:// accepts self-signed / private CA (rarely needed). Default true. */
    REDIS_TLS_REJECT_UNAUTHORIZED: boolFromEnv.default(true),
    CORS_ORIGINS: z.string().default(""),
    AWS_REGION: z.string().default("ap-south-1"),
    AWS_S3_BUCKET: z.string().default(""),
    AWS_ACCESS_KEY_ID: z.string().default(""),
    AWS_SECRET_ACCESS_KEY: z.string().default(""),
    RAZORPAY_KEY_ID: z.string().default(""),
    RAZORPAY_KEY_SECRET: z.string().default(""),
    RAZORPAY_WEBHOOK_SECRET: z.string().default(""),
    MALWARE_SCANNER_MODE: z.enum(["disabled", "clamav", "provider"]).default("disabled"),
    QUARANTINE_S3_BUCKET: z.string().default(""),
    SMS_PROVIDER_URL: z.string().default(""),
    SMS_PROVIDER_TOKEN: z.string().default(""),
    // Spear UC / gateway base URL ending with "&". Credentials live only in the environment.
    SMS_VENDOR_URL: z.string().default(""),
    // vendor = real SMS gateway (production). log = store OTP + log to server (non-production only).
    SMS_DELIVERY_MODE: z.enum(["vendor", "log"]).default("vendor"),
    SMS_OTP_MESSAGE_TEMPLATE: z.string().default(""),
    SMTP_HOST: z.string().default(""),
    SMTP_PORT: z.coerce.number().default(587),
    SMTP_USER: z.string().default(""),
    SMTP_PASS: z.string().default(""),
    /** smtp = nodemailer SMTP; ses = AWS SES API (preferred when Gmail/SMTP is blocked). */
    EMAIL_TRANSPORT: z.enum(["smtp", "ses"]).default("smtp"),
    EMAIL_FROM: emailLoose.default("admin@builtglory.com"),
    ADMIN_EMAIL: emailLoose.default("admin@builtglory.com"),
    WHATSAPP_PROVIDER_URL: z.string().default(""),
    WHATSAPP_PROVIDER_TOKEN: z.string().default(""),
    EMAIL_PROVIDER_URL: z.string().default(""),
    EMAIL_PROVIDER_TOKEN: z.string().default(""),
    PUSH_PROVIDER_URL: z.string().default(""),
    PUSH_PROVIDER_TOKEN: z.string().default(""),
    FIREBASE_PROJECT_ID: z.string().default("builtglory-properties"),
    FIREBASE_CLIENT_EMAIL: z.union([z.literal(""), emailLoose]).default(""),
    FIREBASE_PRIVATE_KEY: z.string().default(""),
    FIREBASE_SERVICE_ACCOUNT_PATH: z.string().default(""),
    APP_CURRENT_VERSION: z.string().default("1.0.0"),
    APP_MIN_SUPPORTED_VERSION: z.string().default("1.0.0"),
    APP_LATEST_VERSION: z.string().default("1.0.0"),
    APP_IOS_STORE_URL: z.string().default("https://apps.apple.com"),
    APP_ANDROID_STORE_URL: z.string().default("https://play.google.com/store/apps"),
    APP_MAINTENANCE_ENABLED: boolFromEnv.default(false),
    APP_MAINTENANCE_MESSAGE: z.string().default("Builtglory is under maintenance. We'll be back shortly."),
    APP_MAINTENANCE_BACK_AT: z.string().default(""),
    APP_FEATURE_FLAGS: z.string().default("{}"),
    COMPANY_SUPPORT_PHONE: z.string().default("+91 8667769670"),
    COMPANY_WHATSAPP_NUMBER: z.string().default(""),
    COMPANY_SUPPORT_EMAIL: emailLoose.default("support@builtglory.com"),
    APP_PUBLIC_URL: z.string().default(""),
    ANDROID_APPLICATION_ID: z.string().default("com.builtglory.builtglory"),
    ANDROID_SHA256_CERT_FINGERPRINTS: z.string().default(""),
    IOS_APP_ID: z.string().default("com.builtglory.builtglory")
  })
  .passthrough()
  .superRefine((data, ctx) => {
    const isProdLike = data.NODE_ENV === "production" || data.NODE_ENV === "staging";
    if (isProdLike && !data.MONGODB_URI) {
      ctx.addIssue({ code: "custom", path: ["MONGODB_URI"], message: "MONGODB_URI is required in production/staging" });
    } else if (isProdLike && /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(String(data.MONGODB_URI))) {
      ctx.addIssue({ code: "custom", path: ["MONGODB_URI"], message: "MONGODB_URI must not use localhost in production/staging" });
    }
    if (!data.MONGODB_URI && !isProdLike) {
      data.MONGODB_URI = "mongodb://127.0.0.1:27017/builtglory";
    }
    if (isProdLike) {
      if (!process.env.JWT_ACCESS_SECRET || data.JWT_ACCESS_SECRET.length < 24) {
        ctx.addIssue({ code: "custom", path: ["JWT_ACCESS_SECRET"], message: "JWT_ACCESS_SECRET is required (min 24 chars) in production/staging" });
      }
      if (!process.env.JWT_REFRESH_SECRET || data.JWT_REFRESH_SECRET.length < 24) {
        ctx.addIssue({ code: "custom", path: ["JWT_REFRESH_SECRET"], message: "JWT_REFRESH_SECRET is required (min 24 chars) in production/staging" });
      }
      if (!process.env.JWT_ISSUER || !String(data.JWT_ISSUER).trim()) {
        ctx.addIssue({ code: "custom", path: ["JWT_ISSUER"], message: "JWT_ISSUER is required in production/staging" });
      }
      if (!process.env.JWT_AUDIENCE || !String(data.JWT_AUDIENCE).trim()) {
        ctx.addIssue({ code: "custom", path: ["JWT_AUDIENCE"], message: "JWT_AUDIENCE is required in production/staging" });
      }
      const resolvedRedis = resolveRedisConnection(data);
      if (resolvedRedis.error) {
        ctx.addIssue({ code: "custom", path: ["REDIS_URL"], message: resolvedRedis.error });
      } else if (resolvedRedis.mode !== "redis") {
        ctx.addIssue({
          code: "custom",
          path: ["REDIS_URL"],
          message: "Redis is required in production/staging. Set REDIS_URL or REDIS_HOST, REDIS_PORT, and REDIS_PASSWORD. REDIS_ENABLED=false is not allowed."
        });
      } else {
        try {
          assertProductionRedisUrl(resolvedRedis.url, data.NODE_ENV);
        } catch (error) {
          ctx.addIssue({ code: "custom", path: ["REDIS_URL"], message: error.message });
        }
      }
      if (!data.CORS_ORIGINS || !String(data.CORS_ORIGINS).trim()) {
        ctx.addIssue({ code: "custom", path: ["CORS_ORIGINS"], message: "CORS_ORIGINS is required in production/staging" });
      } else {
        const origins = String(data.CORS_ORIGINS).split(",").map((s) => s.trim()).filter(Boolean);
        if (origins.some((o) => o === "*" || o.includes("*"))) {
          ctx.addIssue({ code: "custom", path: ["CORS_ORIGINS"], message: "CORS_ORIGINS must not include wildcards in production/staging" });
        }
        if (data.NODE_ENV === "production" && origins.some((o) => /localhost|127\.0\.0\.1/i.test(o))) {
          ctx.addIssue({ code: "custom", path: ["CORS_ORIGINS"], message: "CORS_ORIGINS must not include localhost in production" });
        }
        if (data.NODE_ENV === "production" && origins.some((o) => !/^https:\/\//i.test(o))) {
          ctx.addIssue({ code: "custom", path: ["CORS_ORIGINS"], message: "CORS_ORIGINS must be https:// origins in production" });
        }
      }
      if (!data.APP_PUBLIC_URL || !String(data.APP_PUBLIC_URL).trim()) {
        ctx.addIssue({ code: "custom", path: ["APP_PUBLIC_URL"], message: "APP_PUBLIC_URL is required in production/staging" });
      } else if (data.NODE_ENV === "production") {
        if (/localhost|127\.0\.0\.1/i.test(data.APP_PUBLIC_URL)) {
          ctx.addIssue({ code: "custom", path: ["APP_PUBLIC_URL"], message: "APP_PUBLIC_URL must not be localhost in production" });
        }
        if (!/^https:\/\//i.test(String(data.APP_PUBLIC_URL).trim())) {
          ctx.addIssue({ code: "custom", path: ["APP_PUBLIC_URL"], message: "APP_PUBLIC_URL must be https:// in production" });
        }
      }
      if (data.NODE_ENV === "production" && String(data.EMAIL_TRANSPORT || "smtp").toLowerCase() === "smtp") {
        if (/gmail\.com/i.test(String(data.SMTP_HOST || ""))) {
          ctx.addIssue({
            code: "custom",
            path: ["EMAIL_TRANSPORT"],
            message: "Gmail SMTP is not reliable in production (WebLoginRequired). Use EMAIL_TRANSPORT=ses"
          });
        }
      }
      if (data.NODE_ENV === "production" && /^arn:aws:s3:::/i.test(String(data.AWS_S3_BUCKET || ""))) {
        ctx.addIssue({ code: "custom", path: ["AWS_S3_BUCKET"], message: "AWS_S3_BUCKET must be the bucket name, not an ARN" });
      }
    }
  });

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const messages = parsed.error.issues.map((i) => `${i.path.join(".") || "env"}: ${i.message}`);
  throw new Error("Invalid environment: " + messages.join(", "));
}

const value = parsed.data;
if (!value.MONGODB_URI) {
  value.MONGODB_URI = "mongodb://127.0.0.1:27017/builtglory";
}

const resolvedRedis = resolveRedisConnection(value);
if (resolvedRedis.error) {
  throw new Error(`Invalid environment: REDIS_URL: ${resolvedRedis.error}`);
}
value.REDIS_MODE = resolvedRedis.mode;
value.REDIS_TARGET = resolvedRedis.target || "";
value.REDIS_SOURCE = resolvedRedis.source || "";
if (resolvedRedis.mode === "redis") {
  value.REDIS_URL = resolvedRedis.url;
} else {
  value.REDIS_URL = "";
}

const DEV_ACCESS_SECRET = "dev-access-secret-change-before-production";
const DEV_REFRESH_SECRET = "dev-refresh-secret-change-before-production";
const hosted = Boolean(
  process.env.RENDER
  || process.env.RAILWAY_ENVIRONMENT
  || process.env.FLY_APP_NAME
  || process.env.KUBERNETES_SERVICE_HOST
  || process.env.WEBSITE_INSTANCE_ID
  || process.env.DYNO
);
if (hosted && !process.env.NODE_ENV) {
  throw new Error("Refusing to start: deployed environments must set NODE_ENV=production (or staging) and real JWT secrets.");
}
if (["production", "staging"].includes(value.NODE_ENV)) {
  if (!process.env.JWT_ACCESS_SECRET || value.JWT_ACCESS_SECRET === DEV_ACCESS_SECRET) {
    throw new Error("JWT_ACCESS_SECRET must be a unique secret when NODE_ENV is production or staging.");
  }
  if (!process.env.JWT_REFRESH_SECRET || value.JWT_REFRESH_SECRET === DEV_REFRESH_SECRET) {
    throw new Error("JWT_REFRESH_SECRET must be a unique secret when NODE_ENV is production or staging.");
  }
}

export const env = value;
