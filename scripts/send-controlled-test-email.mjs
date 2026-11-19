/**
 * Controlled SES/SMTP test email — DISABLED unless both flags are set:
 *   APPROVE_TEST_EMAIL=1
 *   SEND_INTEGRATION_TEST_EMAIL=1
 * Recipient: INTEGRATION_TEST_EMAIL or ADMIN_EMAIL (never arbitrary customers).
 *
 * Usage:
 *   APPROVE_TEST_EMAIL=1 SEND_INTEGRATION_TEST_EMAIL=1 node scripts/send-controlled-test-email.mjs
 */
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env") });

if (process.env.APPROVE_TEST_EMAIL !== "1" || process.env.SEND_INTEGRATION_TEST_EMAIL !== "1") {
  console.error("BLOCKED: set APPROVE_TEST_EMAIL=1 and SEND_INTEGRATION_TEST_EMAIL=1 to send a controlled test email.");
  process.exit(2);
}

const to = String(process.env.INTEGRATION_TEST_EMAIL || process.env.ADMIN_EMAIL || "").trim();
if (!to) {
  console.error("BLOCKED: INTEGRATION_TEST_EMAIL or ADMIN_EMAIL required.");
  process.exit(2);
}

const { sendTransactionalEmail } = await import("../src/modules/auth/auth.email.service.js");

try {
  const info = await sendTransactionalEmail({
    to,
    subject: "[BuiltGlory] Controlled integration email test",
    body: "This is a controlled deploy-check email. Safe to ignore."
  });
  console.log(JSON.stringify({
    ok: true,
    to,
    messageId: info.messageId || null,
    accepted: Array.isArray(info.accepted) ? info.accepted.length : null
  }));
  console.log("PASS controlled test email accepted by provider (recipient redacted beyond env config).");
} catch (err) {
  console.error("FAIL", err.code || err.name, err.message);
  process.exit(1);
}
