/**
 * Safe connectivity checks for production readiness.
 *
 * Defaults: no SMS OTP, no customer push, no customer email.
 * Controlled S3 upload/download uses a disposable deploy-check object.
 * Controlled SMTP send only when SEND_INTEGRATION_TEST_EMAIL=1 and
 * INTEGRATION_TEST_EMAIL (or ADMIN_EMAIL) is set — never to arbitrary customers.
 *
 * Never prints credentials or private keys.
 */
import dotenv from "dotenv";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  S3Client,
  HeadBucketCommand,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand
} from "@aws-sdk/client-s3";
import nodemailer from "nodemailer";
import Redis from "ioredis";
import mongoose from "mongoose";
import { buildRedisOptions, isRedisTlsUrl } from "../src/config/redisOptions.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env") });

const results = [];

const note = (name, status, detail = "") => {
  results.push({ name, status, detail });
  console.log(`${status.padEnd(8)} ${name}${detail ? " — " + detail : ""}`);
};

const clean = (value) => String(value || "").trim();
const bucketName = (value) => {
  const bucket = clean(value);
  const arnMatch = bucket.match(/^arn:aws:s3:::(.+)$/);
  return arnMatch ? arnMatch[1] : bucket;
};

const looksLocal = (value) => /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(String(value || ""));

const tcp = (host, port, timeoutMs = 3000) =>
  new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (ok, msg) => {
      try { socket.destroy(); } catch { /* ignore */ }
      resolve({ ok, msg });
    };
    const t = setTimeout(() => done(false, "timeout"), timeoutMs);
    socket.on("connect", () => { clearTimeout(t); done(true, "open"); });
    socket.on("error", (err) => { clearTimeout(t); done(false, err.code || err.message); });
  });

const streamToString = async (stream) => {
  const chunks = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
};

async function checkMongo() {
  try {
    const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/builtglory";
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
    const ping = await mongoose.connection.db.admin().command({ ping: 1 });
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    const setName = hello.setName || hello.me || "";
    const isReplica =
      Boolean(hello.setName)
      || hello.msg === "isdbgrid"
      || Array.isArray(hello.hosts)
      || uri.startsWith("mongodb+srv://");
    note(
      "MongoDB",
      ping?.ok === 1 ? "PASS" : "FAIL",
      `ping setName=${setName || "n/a"} replicaLike=${isReplica}`
    );
    note(
      "MongoDBReplicaSet",
      isReplica ? "PASS" : "FAIL",
      isReplica
        ? (hello.setName ? `set=${hello.setName}` : "mongodb+srv/Atlas topology")
        : "standalone — production requires replica set"
    );
    await mongoose.disconnect();
  } catch (err) {
    note("MongoDB", "FAIL", err.message);
    note("MongoDBReplicaSet", "FAIL", err.message);
  }
}

async function checkRedis() {
  try {
    const url = process.env.REDIS_URL || "redis://127.0.0.1:6379";
    const isTls = isRedisTlsUrl(url);
    const isLocal = looksLocal(url);
    const redis = new Redis(url, {
      ...buildRedisOptions(url, { maxRetriesPerRequest: 1, connectTimeout: 5000 }),
      lazyConnect: true
    });
    await redis.connect();
    const pong = await redis.ping();
    const key = `deploycheck:${Date.now()}`;
    await redis.set(key, "1", "EX", 10);
    const got = await redis.get(key);
    await redis.del(key);
    await redis.quit();
    note("Redis", pong === "PONG" && got === "1" ? "PASS" : "FAIL", isTls ? "TLS rediss ping+setex" : "ping+setex");
    note(
      "RedisManagedTls",
      isTls && !isLocal ? "PASS" : "BLOCKED",
      isTls && !isLocal
        ? "managed TLS URL"
        : "production requires non-local rediss:// — see deploy/MANUAL_SETUP.md"
    );
  } catch (err) {
    note("Redis", "FAIL", err.message);
    note("RedisManagedTls", "FAIL", err.message);
  }
}

async function checkS3() {
  const bucket = bucketName(process.env.AWS_S3_BUCKET);
  const region = clean(process.env.AWS_REGION) || "ap-south-1";
  const accessKeyId = clean(process.env.AWS_ACCESS_KEY_ID);
  const secretAccessKey = clean(process.env.AWS_SECRET_ACCESS_KEY);

  if (!bucket || !accessKeyId || !secretAccessKey) {
    note("S3", "SKIP", "credentials/bucket not fully set");
    note("S3UploadDownload", "SKIP", "skipped");
    return;
  }

  if (/^arn:aws:s3:::/i.test(clean(process.env.AWS_S3_BUCKET))) {
    note("S3", "FAIL", "AWS_S3_BUCKET must be the bucket name, not an ARN (normalized for this check)");
  }

  const client = new S3Client({
    region,
    credentials: { accessKeyId, secretAccessKey }
  });

  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    note("S3", "PASS", `HeadBucket region=${region} bucket=${bucket}`);
  } catch (err) {
    note("S3", "FAIL", `${err.name || "Error"}: ${err.message}`);
    note("S3UploadDownload", "FAIL", "blocked by HeadBucket failure");
    return;
  }

  const key = `deploy-checks/integration-${Date.now()}.txt`;
  const body = `builtglory-deploy-check ${new Date().toISOString()}`;
  try {
    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: "text/plain"
    }));
    const got = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const text = await streamToString(got.Body);
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    note("S3UploadDownload", text === body ? "PASS" : "FAIL", text === body ? "put+get+delete" : "payload mismatch");
  } catch (err) {
    note("S3UploadDownload", "FAIL", `${err.name || "Error"}: ${err.message}`);
  }
}

function createSmtpTransport() {
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = process.env.SMTP_SECURE === "true" || port === 465;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    requireTLS: !secure && port === 587,
    auth: process.env.SMTP_USER
      ? {
          user: process.env.SMTP_USER,
          pass: String(process.env.SMTP_PASS || "").replace(/\s+/g, "")
        }
      : undefined,
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 10000
  });
}

async function checkSesTransport() {
  const {
    SESClient,
    GetSendQuotaCommand,
    GetAccountSendingEnabledCommand,
    ListIdentitiesCommand,
    GetIdentityVerificationAttributesCommand,
    SendEmailCommand,
    VerifyEmailIdentityCommand
  } = await import("@aws-sdk/client-ses");
  const region = clean(process.env.AWS_REGION) || "ap-south-1";
  const accessKeyId = clean(process.env.AWS_ACCESS_KEY_ID);
  const secretAccessKey = clean(process.env.AWS_SECRET_ACCESS_KEY);
  if (!accessKeyId || !secretAccessKey) {
    note("SMTP", "FAIL", "EMAIL_TRANSPORT=ses but AWS credentials missing");
    note("SMTPTestEmail", "BLOCKED", "no AWS credentials");
    return;
  }

  const client = new SESClient({ region, credentials: { accessKeyId, secretAccessKey } });
  try {
    const [quota, sending, identities] = await Promise.all([
      client.send(new GetSendQuotaCommand({})),
      client.send(new GetAccountSendingEnabledCommand({})),
      client.send(new ListIdentitiesCommand({ MaxItems: 50 }))
    ]);
    const ids = identities.Identities || [];
    let verification = {};
    if (ids.length) {
      const attrs = await client.send(new GetIdentityVerificationAttributesCommand({ Identities: ids }));
      verification = Object.fromEntries(
        Object.entries(attrs.VerificationAttributes || {}).map(([id, row]) => [id, row.VerificationStatus])
      );
    }
    const verified = ids.filter((id) => verification[id] === "Success");
    note(
      "SMTP",
      sending.Enabled ? "PASS" : "FAIL",
      `SES region=${region} sending=${sending.Enabled} quota24h=${quota.Max24HourSend} verified=${verified.length}/${ids.length}`
    );

    const from = clean(process.env.EMAIL_FROM || process.env.ADMIN_EMAIL || "");
    const allowSend = process.env.SEND_INTEGRATION_TEST_EMAIL === "1" && process.env.APPROVE_TEST_EMAIL === "1";
    const to = clean(process.env.INTEGRATION_TEST_EMAIL || process.env.ADMIN_EMAIL || "");
    const fromVerified = from && verification[from] === "Success";

    if (!ids.length || !verified.length) {
      if (process.env.SEND_SES_VERIFY === "1" && from) {
        await client.send(new VerifyEmailIdentityCommand({ EmailAddress: from }));
        note("SMTPTestEmail", "BLOCKED", `SES verification email requested for ${from}; click link, then APPROVE_TEST_EMAIL=1 SEND_INTEGRATION_TEST_EMAIL=1`);
      } else {
        note(
          "SMTPTestEmail",
          "BLOCKED",
          `no verified SES identities (pending=${ids.filter((id) => verification[id] !== "Success").join(",") || "none"}) — see deploy/MANUAL_SETUP.md`
        );
      }
      return;
    }

    if (!fromVerified) {
      note("SMTPTestEmail", "BLOCKED", `EMAIL_FROM not verified in SES (status=${verification[from] || "missing"})`);
      return;
    }

    if (!allowSend) {
      note("SMTPTestEmail", "BLOCKED", "set APPROVE_TEST_EMAIL=1 and SEND_INTEGRATION_TEST_EMAIL=1 for controlled send");
      return;
    }
    if (!to || !from) {
      note("SMTPTestEmail", "BLOCKED", "INTEGRATION_TEST_EMAIL/ADMIN_EMAIL and EMAIL_FROM required");
      return;
    }

    const result = await client.send(new SendEmailCommand({
      Source: from,
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: "[BuiltGlory] Integration SES test", Charset: "UTF-8" },
        Body: { Text: { Data: "Controlled deploy-check email via Amazon SES. Safe to ignore.", Charset: "UTF-8" } }
      }
    }));
    note("SMTPTestEmail", result.MessageId ? "PASS" : "FAIL", `ses MessageId=${result.MessageId || "n/a"}`);
  } catch (err) {
    note("SMTP", "FAIL", `${err.name || "Error"}: ${err.message}`);
    note("SMTPTestEmail", "BLOCKED", "SES API error");
  }
}

async function checkSmtp() {
  const transport = clean(process.env.EMAIL_TRANSPORT || "smtp").toLowerCase();
  if (transport === "ses") {
    await checkSesTransport();
    return;
  }

  if (!process.env.SMTP_HOST) {
    note("SMTP", "SKIP", "SMTP_HOST unset");
    note("SMTPTestEmail", "SKIP", "skipped");
    return;
  }

  const transporter = createSmtpTransport();
  try {
    await transporter.verify();
    note("SMTP", "PASS", `verify host=${process.env.SMTP_HOST} port=${process.env.SMTP_PORT || 587}`);
  } catch (err) {
    const msg = err.message || String(err);
    const blocked = /WebLoginRequired|Application-specific password|Invalid login|535|534/i.test(msg);
    note("SMTP", blocked ? "BLOCKED" : "FAIL", msg);
    note(
      "SMTPTestEmail",
      "BLOCKED",
      blocked
        ? "Gmail SMTP blocked — set EMAIL_TRANSPORT=ses after verifying EMAIL_FROM in SES"
        : "verify failed; no send attempted"
    );
    return;
  }

  const allowSend = process.env.SEND_INTEGRATION_TEST_EMAIL === "1";
  const to = clean(process.env.INTEGRATION_TEST_EMAIL || process.env.ADMIN_EMAIL || "");
  if (!allowSend) {
    note("SMTPTestEmail", "BLOCKED", "set SEND_INTEGRATION_TEST_EMAIL=1 and INTEGRATION_TEST_EMAIL to send controlled test");
    return;
  }
  if (!to) {
    note("SMTPTestEmail", "BLOCKED", "INTEGRATION_TEST_EMAIL or ADMIN_EMAIL required for controlled send");
    return;
  }

  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to,
      subject: "[BuiltGlory] Integration SMTP test",
      text: "Controlled deploy-check email. Safe to ignore."
    });
    note(
      "SMTPTestEmail",
      info.accepted?.length ? "PASS" : "FAIL",
      `messageId=${info.messageId || "n/a"} accepted=${(info.accepted || []).length}`
    );
  } catch (err) {
    note("SMTPTestEmail", "FAIL", err.message);
  }
}

async function checkSms() {
  try {
    const vendor = process.env.SMS_VENDOR_URL || process.env.SMS_PROVIDER_URL || "";
    if (!vendor) {
      note("SMS", "SKIP", "no vendor URL");
      return;
    }
    const u = new URL(vendor);
    const port = Number(u.port || (u.protocol === "https:" ? 443 : 80));
    const r = await tcp(u.hostname, port);
    const mode = clean(process.env.SMS_DELIVERY_MODE) || "vendor";
    if (mode === "log") {
      note("SMS", "FAIL", "SMS_DELIVERY_MODE=log forbidden for production readiness");
      return;
    }
    note("SMS", r.ok ? "PASS" : "FAIL", `tcp ${u.hostname}:${port} ${r.msg}; mode=${mode}; no OTP sent`);
  } catch (err) {
    note("SMS", "FAIL", err.message);
  }
}

async function checkFirebase() {
  try {
    const { getFirebaseApp, isFirebaseConfigured } = await import("../src/services/firebase.service.js");
    if (!isFirebaseConfigured()) {
      note("Firebase", "FAIL", "credentials missing or invalid");
      return;
    }
    const app = getFirebaseApp();
    const token = await app.options.credential.getAccessToken();
    note(
      "Firebase",
      token?.access_token ? "PASS" : "FAIL",
      token?.access_token
        ? `Admin SDK credential token OK project=${clean(process.env.FIREBASE_PROJECT_ID) || "n/a"} (no push sent)`
        : "access token empty"
    );
  } catch (err) {
    note("Firebase", "FAIL", err.message);
  }
}

function checkHttpsUrls() {
  const cors = clean(process.env.CORS_ORIGINS);
  const appPublic = clean(process.env.APP_PUBLIC_URL);
  const nodeEnv = clean(process.env.NODE_ENV) || "development";

  if (!cors) {
    note("CorsOrigins", "FAIL", "CORS_ORIGINS unset");
  } else {
    const origins = cors.split(",").map((s) => s.trim()).filter(Boolean);
    const hasWildcard = origins.some((o) => o === "*" || o.includes("*"));
    const hasLocal = origins.some(looksLocal);
    const nonHttps = origins.filter((o) => !/^https:\/\//i.test(o));
    if (hasWildcard) note("CorsOrigins", "FAIL", "wildcard not allowed");
    else if (nodeEnv === "production" && hasLocal) note("CorsOrigins", "FAIL", "localhost in production");
    else if (nodeEnv === "production" && nonHttps.length) note("CorsOrigins", "FAIL", "non-HTTPS origins in production");
    else if (hasLocal) note("CorsOrigins", "PASS", `dev localhost allowed count=${origins.length}`);
    else if (nonHttps.length) note("CorsOrigins", "BLOCKED", "production HTTPS origins not configured yet");
    else note("CorsOrigins", "PASS", `https count=${origins.length}`);
  }

  if (!appPublic) {
    note("AppPublicUrl", "BLOCKED", "APP_PUBLIC_URL unset — required for production deep links");
  } else if (looksLocal(appPublic)) {
    note("AppPublicUrl", nodeEnv === "production" ? "FAIL" : "BLOCKED", "localhost not valid for production");
  } else if (!/^https:\/\//i.test(appPublic)) {
    note("AppPublicUrl", "FAIL", "must be https://");
  } else {
    note("AppPublicUrl", "PASS", "https public URL set");
  }

  note(
    "DashboardApiUrl",
    "BLOCKED",
    "code supports same-origin or HTTPS VITE_API_URL — set live host in Dashboard .env.production"
  );
  note(
    "SocketIoProxy",
    "BLOCKED",
    "code supports same-origin / HTTPS socket origin — apply deploy/nginx.admin.example.conf on the host"
  );
}

async function main() {
  console.log("Integration checks (secrets redacted)\n");
  checkHttpsUrls();
  await checkMongo();
  await checkRedis();
  await checkS3();
  await checkSmtp();
  await checkSms();
  await checkFirebase();

  const failed = results.filter((r) => r.status === "FAIL");
  const blocked = results.filter((r) => r.status === "BLOCKED");
  console.log(`\nSummary: PASS=${results.filter((r) => r.status === "PASS").length} FAIL=${failed.length} BLOCKED=${blocked.length} SKIP=${results.filter((r) => r.status === "SKIP").length}`);
  if (failed.length) {
    console.log("Failed:", failed.map((r) => r.name).join(", "));
    process.exit(1);
  }
  console.log("No FAIL results. BLOCKED items need external production resources/approval.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
