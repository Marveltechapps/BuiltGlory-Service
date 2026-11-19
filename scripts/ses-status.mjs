/**
 * Safe SES status check — never sends email.
 * Usage: npm run check:ses
 */
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env") });

const { getSesSendingStatus } = await import("../src/modules/auth/auth.email.service.js");

try {
  const status = await getSesSendingStatus();
  const verified = Object.entries(status.verification)
    .filter(([, state]) => state === "Success")
    .map(([id]) => id);
  const pending = Object.entries(status.verification)
    .filter(([, state]) => state !== "Success")
    .map(([id, state]) => `${id}:${state}`);

  console.log(JSON.stringify({
    ok: true,
    region: status.region,
    max24HourSend: status.max24HourSend,
    sentLast24Hours: status.sentLast24Hours,
    identityCount: status.identities.length,
    verifiedCount: verified.length,
    pending,
    fromConfigured: status.fromConfigured,
    fromVerified: status.fromVerified
  }, null, 2));

  if (!status.fromVerified) {
    console.log("BLOCKED: EMAIL_FROM is not a verified SES identity. Complete AWS SES verification (see deploy/MANUAL_SETUP.md).");
    process.exit(2);
  }
  console.log("PASS SES identity ready for sending (no email sent).");
  process.exit(0);
} catch (err) {
  console.error("FAIL", err.message);
  process.exit(1);
}
