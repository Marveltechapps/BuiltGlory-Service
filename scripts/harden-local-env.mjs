/**
 * Hardens local .env for deployment prep:
 * - Ensures REDIS_URL
 * - Rotates weak/dev JWT secrets to cryptographically secure values
 * - Sets explicit JWT_ISSUER / JWT_AUDIENCE
 * Never prints secret values.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, ".env");

const DEV_ACCESS = "dev-access-secret-change-before-production";
const DEV_REFRESH = "dev-refresh-secret-change-before-production";

const secret = (bytes = 48) => crypto.randomBytes(bytes).toString("base64url");

const parseEnv = (raw) => {
  const map = new Map();
  const order = [];
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#") || !line.includes("=")) {
      order.push({ type: "raw", line });
      continue;
    }
    const i = line.indexOf("=");
    const key = line.slice(0, i);
    const value = line.slice(i + 1);
    map.set(key, value);
    order.push({ type: "kv", key });
  }
  return { map, order };
};

const writeEnv = ({ map, order }, updates) => {
  for (const [k, v] of Object.entries(updates)) {
    if (!map.has(k)) order.push({ type: "kv", key: k });
    map.set(k, v);
  }
  const seen = new Set();
  const lines = [];
  for (const item of order) {
    if (item.type === "raw") {
      lines.push(item.line);
      continue;
    }
    if (seen.has(item.key)) continue;
    seen.add(item.key);
    lines.push(`${item.key}=${map.get(item.key) ?? ""}`);
  }
  for (const key of map.keys()) {
    if (seen.has(key)) continue;
    lines.push(`${key}=${map.get(key)}`);
  }
  fs.writeFileSync(envPath, lines.join("\n").replace(/\n*$/, "\n"), "utf8");
};

if (!fs.existsSync(envPath)) {
  console.error("Missing .env — copy from .env.example first.");
  process.exit(1);
}

const parsed = parseEnv(fs.readFileSync(envPath, "utf8"));
const updates = {};
const report = [];

const access = parsed.map.get("JWT_ACCESS_SECRET") || "";
const refresh = parsed.map.get("JWT_REFRESH_SECRET") || "";
const weakAccess = !access || access === DEV_ACCESS || access.length < 48;
const weakRefresh = !refresh || refresh === DEV_REFRESH || refresh.length < 48 || refresh === access;

if (weakAccess) {
  updates.JWT_ACCESS_SECRET = secret(48);
  report.push("JWT_ACCESS_SECRET=rotated");
} else {
  report.push("JWT_ACCESS_SECRET=kept(strong)");
}

if (weakRefresh) {
  updates.JWT_REFRESH_SECRET = secret(48);
  report.push("JWT_REFRESH_SECRET=rotated");
} else {
  report.push("JWT_REFRESH_SECRET=kept(strong)");
}

if (!parsed.map.get("JWT_ISSUER")) {
  updates.JWT_ISSUER = "builtglory-api";
  report.push("JWT_ISSUER=set");
} else {
  report.push("JWT_ISSUER=present");
}

if (!parsed.map.get("JWT_AUDIENCE")) {
  updates.JWT_AUDIENCE = "builtglory-clients";
  report.push("JWT_AUDIENCE=set");
} else {
  report.push("JWT_AUDIENCE=present");
}

const redis = parsed.map.get("REDIS_URL") || "";
if (!redis || !/^redis(s)?:\/\//i.test(redis)) {
  updates.REDIS_URL = "redis://127.0.0.1:6379";
  report.push("REDIS_URL=set(local)");
} else {
  report.push("REDIS_URL=present");
}

writeEnv(parsed, updates);
console.log("harden-local-env: " + report.join(", "));
console.log("Secrets were written to .env and are not printed.");
