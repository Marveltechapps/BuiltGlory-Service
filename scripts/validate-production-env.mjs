/**
 * Validates production-like env without printing secret values.
 * Usage:
 *   node scripts/validate-production-env.mjs
 *   node scripts/validate-production-env.mjs --file .env.production
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const fileIdx = args.indexOf("--file");
const envFile = fileIdx >= 0 ? args[fileIdx + 1] : ".env.production";
const envPath = path.isAbsolute(envFile) ? envFile : path.join(root, envFile);

if (!fs.existsSync(envPath)) {
  console.error(`FAIL missing env file: ${envFile}`);
  process.exit(1);
}

dotenv.config({ path: envPath, override: true });
const e = process.env;
const issues = [];
const ok = [];

const present = (k) => Boolean(e[k] && String(e[k]).trim());
const len = (k) => (e[k] ? String(e[k]).length : 0);
const looksLocal = (v = "") => /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(v);
const isHttpsOrigin = (v) => /^https:\/\/[^/\s]+$/i.test(v.trim());

if (e.NODE_ENV !== "production" && e.NODE_ENV !== "staging") {
  issues.push(`NODE_ENV must be production|staging (got ${e.NODE_ENV || "unset"})`);
} else ok.push(`NODE_ENV=${e.NODE_ENV}`);

const mongoDbName = (uri = "") => {
  const pathOnly = String(uri).split("?")[0];
  const name = pathOnly.split("/").pop() || "";
  try { return decodeURIComponent(name); } catch { return name; }
};

if (!present("MONGODB_URI")) issues.push("MONGODB_URI missing");
else if (looksLocal(e.MONGODB_URI) && (e.NODE_ENV === "production" || e.NODE_ENV === "staging")) {
  issues.push("MONGODB_URI appears localhost — staging and production must use a managed replica set URI");
} else if (!/^mongodb(\+srv)?:\/\//i.test(e.MONGODB_URI)) {
  issues.push("MONGODB_URI scheme invalid");
} else if (e.NODE_ENV === "staging" && !/staging/i.test(mongoDbName(e.MONGODB_URI))) {
  issues.push("staging MONGODB_URI database name must include 'staging' so it cannot reuse the production database");
} else ok.push("MONGODB_URI=set(scheme-ok)");

const hostedEnv = e.NODE_ENV === "production" || e.NODE_ENV === "staging";
if (!present("REDIS_URL")) issues.push("REDIS_URL missing (in-memory sessions forbidden in production/staging)");
else if (!/^redis(s)?:\/\//i.test(e.REDIS_URL)) issues.push("REDIS_URL scheme invalid");
else if (hostedEnv && !/^rediss:\/\//i.test(e.REDIS_URL)) {
  issues.push("REDIS_URL must use rediss:// (TLS) in production and staging");
} else if (looksLocal(e.REDIS_URL) && hostedEnv) {
  issues.push("REDIS_URL is local — use a private managed Redis endpoint");
} else ok.push(/^rediss:/i.test(e.REDIS_URL) ? "REDIS_URL=rediss(TLS)" : "REDIS_URL=set");

for (const k of ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"]) {
  if (!present(k)) issues.push(`${k} missing`);
  else if (String(e[k]).includes("dev-") || len(k) < 48) issues.push(`${k} weak (need unique >=48 chars)`);
  else ok.push(`${k}=strong(len=${len(k)})`);
}
if (present("JWT_ACCESS_SECRET") && e.JWT_ACCESS_SECRET === e.JWT_REFRESH_SECRET) {
  issues.push("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ");
}

if (!present("JWT_ISSUER")) issues.push("JWT_ISSUER missing");
else ok.push(`JWT_ISSUER=set`);
if (!present("JWT_AUDIENCE")) issues.push("JWT_AUDIENCE missing");
else ok.push(`JWT_AUDIENCE=set`);

const productionHosts = new Set(["app.builtglory.com", "admin.builtglory.com", "api.builtglory.com", "www.builtglory.com"]);
if (!present("CORS_ORIGINS")) issues.push("CORS_ORIGINS missing");
else {
  const origins = String(e.CORS_ORIGINS).split(",").map((s) => s.trim()).filter(Boolean);
  if (!origins.length) issues.push("CORS_ORIGINS empty");
  if (origins.some((o) => o === "*" || o.includes("*"))) issues.push("CORS_ORIGINS must not use wildcards");
  if (hostedEnv && origins.some(looksLocal)) issues.push("CORS_ORIGINS contains localhost in production/staging");
  if (hostedEnv && origins.some((o) => !isHttpsOrigin(o))) {
    issues.push("CORS_ORIGINS entries must be https:// origins in production/staging");
  }
  if (e.NODE_ENV === "staging") {
    for (const origin of origins) {
      let host = "";
      try { host = new URL(origin).hostname; } catch { host = ""; }
      if (!/staging/i.test(host)) issues.push(`staging CORS origin must use a staging hostname: ${origin}`);
      if (productionHosts.has(host)) issues.push(`staging CORS must not allow production host ${host}`);
    }
  }
  if (!issues.some((i) => i.includes("CORS"))) ok.push(`CORS_ORIGINS=count=${origins.length}`);
}

const useInstanceRole = /^(1|true)$/i.test(String(e.AWS_USE_INSTANCE_ROLE || ""));
for (const k of ["AWS_S3_BUCKET", "AWS_REGION"]) {
  if (!present(k)) issues.push(`${k} missing`);
  else ok.push(`${k}=set`);
}
if (e.NODE_ENV === "staging" && present("AWS_S3_BUCKET") && !/staging/i.test(e.AWS_S3_BUCKET)) {
  issues.push("staging AWS_S3_BUCKET name must include 'staging'");
}
if (useInstanceRole) ok.push("AWS credentials=instance-role");
else {
  for (const k of ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"]) {
    if (!present(k)) issues.push(`${k} missing (or set AWS_USE_INSTANCE_ROLE=true)`);
    else ok.push(`${k}=set`);
  }
}

if (!present("SMS_VENDOR_URL") && !present("SMS_PROVIDER_URL")) issues.push("SMS_VENDOR_URL or SMS_PROVIDER_URL missing");
else ok.push("SMS=configured");
if (e.SMS_DELIVERY_MODE === "log" && e.NODE_ENV === "production") {
  issues.push("SMS_DELIVERY_MODE=log is not allowed in production");
}

if (!present("EMAIL_FROM")) issues.push("EMAIL_FROM missing");
else ok.push("EMAIL_FROM=set");

const emailTransport = String(e.EMAIL_TRANSPORT || "smtp").toLowerCase();
if (emailTransport === "ses") {
  ok.push("EMAIL_TRANSPORT=ses");
  if (!present("AWS_REGION")) issues.push("AWS_REGION required for EMAIL_TRANSPORT=ses");
  if (!useInstanceRole) {
    for (const k of ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"]) {
      if (!present(k)) issues.push(`${k} required for EMAIL_TRANSPORT=ses unless AWS_USE_INSTANCE_ROLE=true`);
    }
  }
} else {
  if (e.NODE_ENV === "production" && /gmail\.com/i.test(String(e.SMTP_HOST || ""))) {
    issues.push("Gmail SMTP is not allowed in production — set EMAIL_TRANSPORT=ses");
  }
  for (const k of ["SMTP_HOST", "SMTP_USER", "SMTP_PASS"]) {
    if (!present(k)) issues.push(`${k} missing`);
    else ok.push(`${k}=set`);
  }
}

if (!present("APP_PUBLIC_URL")) issues.push("APP_PUBLIC_URL missing");
else if (looksLocal(e.APP_PUBLIC_URL)) issues.push("APP_PUBLIC_URL must not be localhost");
else if (!/^https:\/\//i.test(e.APP_PUBLIC_URL)) issues.push("APP_PUBLIC_URL must be https://");
else if (e.NODE_ENV === "staging" && !/staging/i.test(e.APP_PUBLIC_URL)) {
  issues.push("staging APP_PUBLIC_URL hostname must include 'staging'");
} else ok.push("APP_PUBLIC_URL=https");

if (present("AWS_S3_BUCKET") && /^arn:aws:s3:::/i.test(e.AWS_S3_BUCKET)) {
  issues.push("AWS_S3_BUCKET must be the bucket name, not an ARN");
}

const firebaseOk =
  (present("FIREBASE_PROJECT_ID") && present("FIREBASE_CLIENT_EMAIL") && present("FIREBASE_PRIVATE_KEY"))
  || present("FIREBASE_SERVICE_ACCOUNT_PATH")
  || (present("PUSH_PROVIDER_URL") && present("PUSH_PROVIDER_TOKEN"));
if (!firebaseOk) issues.push("Firebase or PUSH_PROVIDER credentials missing");
else ok.push("Push=configured");

console.log("OK: " + ok.join("; "));
if (issues.length) {
  console.log("FAIL:");
  for (const i of issues) console.log(" - " + i);
  process.exit(1);
}
console.log("PASS production env validation (secrets not printed).");
