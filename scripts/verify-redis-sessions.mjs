/**
 * Verifies Redis-backed admin session + refresh rotation against a running API.
 * Does not print tokens.
 */
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Redis from "ioredis";
import { buildRedisOptions, isRedisTlsUrl, resolveRedisConnection } from "../src/config/redisOptions.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env") });

const API = process.env.VERIFY_API_URL || `http://127.0.0.1:${process.env.PORT || 5001}`;
const email = process.env.SEED_ADMIN_EMAIL || "admin@builtglory.com";
const password = process.env.SEED_ADMIN_PASSWORD || "ChangeMe123!";
const resolvedRedis = resolveRedisConnection(process.env);
const redisUrl = resolvedRedis.url;
if (!redisUrl) {
  console.error("FAIL Redis is not configured. Set REDIS_URL or REDIS_HOST, REDIS_PORT, and REDIS_PASSWORD.");
  process.exit(1);
}

const json = async (res) => {
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { raw: text }; }
};

const main = async () => {
  const loginRes = await fetch(`${API}/api/v1/auth/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  const loginBody = await json(loginRes);
  if (loginRes.status !== 200) throw new Error(`login failed: ${loginRes.status}`);
  const access1 = loginBody.data?.accessToken;
  const refresh1 = loginBody.data?.refreshToken;
  if (!access1 || !refresh1) throw new Error("login missing tokens");

  const redis = new Redis(redisUrl, buildRedisOptions(redisUrl, { maxRetriesPerRequest: 1, connectTimeout: 5000 }));
  const keys = await redis.keys("session:*");
  const refreshKeys = await redis.keys("refresh:*");
  if (!keys.length) throw new Error("no session:* keys after login — Redis not used");
  if (!refreshKeys.length) throw new Error("no refresh:* keys after login");

  const refreshRes = await fetch(`${API}/api/v1/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: refresh1 })
  });
  const refreshBody = await json(refreshRes);
  if (refreshRes.status !== 200) throw new Error(`refresh failed: ${refreshRes.status}`);
  const access2 = refreshBody.data?.accessToken;
  const refresh2 = refreshBody.data?.refreshToken;
  if (!access2 || !refresh2) throw new Error("refresh missing tokens");
  if (refresh2 === refresh1) throw new Error("refresh token was not rotated");

  // Prove rotated access works before exercising reuse detection (reuse marks the sid compromised).
  const overview = await fetch(`${API}/api/v1/admin/overview`, {
    headers: { Authorization: `Bearer ${access2}` }
  });
  if (overview.status !== 200) throw new Error(`overview with rotated access failed: ${overview.status}`);

  const reuse = await fetch(`${API}/api/v1/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: refresh1 })
  });
  if (![400, 401, 403, 409].includes(reuse.status)) {
    throw new Error(`expected reuse rejection, got ${reuse.status}`);
  }

  await redis.quit();
  console.log("PASS Redis session persistence + refresh rotation + reuse rejection");
  console.log(`tls=${isRedisTlsUrl(redisUrl)} sessionKeys=${keys.length} refreshKeys=${refreshKeys.length} (counts only)`);
};

main().catch((err) => {
  console.error("FAIL", err.message);
  process.exit(1);
});
