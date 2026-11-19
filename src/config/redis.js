import Redis from "ioredis";
import { env } from "./env.js";
import { logger } from "./logger.js";
import { assertProductionRedisUrl, buildRedisOptions } from "./redisOptions.js";

let redis;
const memory = new Map();

const memoryClient = () => ({
  async get(k) {
    const row = memory.get(k);
    if (!row) return null;
    if (row.expiresAt && row.expiresAt < Date.now()) {
      memory.delete(k);
      return null;
    }
    return row.value;
  },
  async set(k, v, mode, ttl, nx) {
    if (nx === "NX") {
      const current = memory.get(k);
      if (current && !(current.expiresAt && current.expiresAt < Date.now())) return null;
    }
    memory.set(k, { value: v, expiresAt: mode === "EX" ? Date.now() + ttl * 1000 : null });
    return "OK";
  },
  async del(...keys) {
    let n = 0;
    for (const k of keys) {
      if (memory.delete(k)) n += 1;
    }
    return n;
  },
  async incr(k) {
    const row = memory.get(k);
    if (row?.expiresAt && row.expiresAt < Date.now()) memory.delete(k);
    const current = Number((memory.get(k)?.value) || 0);
    const next = current + 1;
    const expiresAt = memory.get(k)?.expiresAt ?? null;
    memory.set(k, { value: String(next), expiresAt });
    return next;
  },
  async decr(k) {
    const row = memory.get(k);
    if (row?.expiresAt && row.expiresAt < Date.now()) memory.delete(k);
    const current = Number((memory.get(k)?.value) || 0);
    const next = current - 1;
    const expiresAt = memory.get(k)?.expiresAt ?? null;
    memory.set(k, { value: String(next), expiresAt });
    return next;
  },
  async expire(k, ttlSeconds) {
    const row = memory.get(k);
    if (!row) return 0;
    row.expiresAt = Date.now() + ttlSeconds * 1000;
    return 1;
  },
  async pexpire(k, ttlMs) {
    const row = memory.get(k);
    if (!row) return 0;
    row.expiresAt = Date.now() + ttlMs;
    return 1;
  },
  async pttl(k) {
    const row = memory.get(k);
    if (!row) return -2;
    if (!row.expiresAt) return -1;
    return Math.max(0, row.expiresAt - Date.now());
  },
  async ping() {
    return "PONG";
  }
});

export const getRedis = () => {
  if (redis) return redis;

  const isProdLike = env.NODE_ENV === "production" || env.NODE_ENV === "staging";
  if (!env.REDIS_URL) {
    if (isProdLike) throw new Error("REDIS_URL is required in production/staging.");
    return memoryClient();
  }

  if (isProdLike) {
    assertProductionRedisUrl(env.REDIS_URL, env.NODE_ENV);
  }

  redis = new Redis(
    env.REDIS_URL,
    buildRedisOptions(env.REDIS_URL, {
      tlsRejectUnauthorized: env.REDIS_TLS_REJECT_UNAUTHORIZED !== false,
      maxRetriesPerRequest: 2,
      connectTimeout: 10_000
    })
  );

  redis.on("connect", () => logger.info({ message: "Redis connecting" }));
  redis.on("ready", () => logger.info({ message: "Redis ready", tls: /^rediss:/i.test(env.REDIS_URL) }));
  redis.on("reconnecting", (delay) => logger.warn({ message: "Redis reconnecting", delayMs: delay }));
  redis.on("end", () => logger.warn({ message: "Redis connection ended" }));
  redis.on("error", (error) => logger.error({ message: "Redis error", error: error.message }));

  return redis;
};

export const closeRedis = async () => {
  if (!redis) return;
  const client = redis;
  redis = undefined;
  try {
    await client.quit();
  } catch {
    client.disconnect();
  }
};
