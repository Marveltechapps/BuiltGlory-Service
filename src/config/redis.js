import Redis from "ioredis";
import { env } from "./env.js";
import { logger } from "./logger.js";
import { buildRedisOptions, resolveRedisConnection } from "./redisOptions.js";

const resolved = resolveRedisConnection(env);
const isProdLike = env.NODE_ENV === "production" || env.NODE_ENV === "staging";
const probeMs = Math.max(250, Number(env.REDIS_RECONNECT_PROBE_MS) || 15_000);

const memory = new Map();
const localOptionalCache = new Map();
const companions = new Set();
const readyListeners = new Set();

let redis;
let probeTimer;
let shuttingDown = false;
let stopRetrying = false;
let optionalCacheFallbackLogged = false;
let lastLoggedError = "";

const status = {
  mode: resolved.mode === "redis" ? "redis" : "memory",
  state: resolved.mode === "redis" ? "idle" : "memory",
  configured: Boolean(resolved.configured),
  target: resolved.target || "",
  source: resolved.source || "",
  attempts: 0,
  lastError: null,
  probeMs
};

const CRITICAL_CACHE_PREFIX = /^(otp:|otp$|session:|refresh:|access:|job:lock:|rl:|phone-change-verified:|used-refresh:)/;

export const isRedisDependencyError = (error) => {
  if (!error) return false;
  const name = String(error.name || "");
  const code = String(error.code || error.cause?.code || "");
  const message = String(error.message || "");
  if (name === "MaxRetriesPerRequestError") return true;
  if (["ECONNREFUSED", "ETIMEDOUT", "ECONNRESET", "EPIPE", "ENOTFOUND", "EAI_AGAIN", "NR_CLOSED", "EHOSTUNREACH"].includes(code)) return true;
  return /MaxRetriesPerRequest|Reached the max retries per request|Connection is closed|Stream isn't writeable|enableOfflineQueue|Ready check failed|connect ECONNREFUSED|connect ETIMEDOUT/i.test(message);
};

export const getRedisStatus = () => ({ ...status });

export const isRedisConfigured = () => status.mode === "redis";

export const isRedisReady = () => status.state === "ready" || status.state === "memory";

const notifyReady = () => {
  for (const listener of [...readyListeners]) {
    try {
      listener();
    } catch (error) {
      logger.error({ message: "Redis ready listener failed", error: error.message });
    }
  }
};

export const onRedisReady = (listener) => {
  if (status.state === "ready") {
    listener();
    return () => {};
  }
  readyListeners.add(listener);
  return () => readyListeners.delete(listener);
};

const clearProbe = () => {
  if (!probeTimer) return;
  clearTimeout(probeTimer);
  probeTimer = null;
};

const scheduleProbe = () => {
  if (shuttingDown || stopRetrying || probeTimer || status.mode !== "redis" || status.state === "ready") return;
  probeTimer = setTimeout(() => {
    probeTimer = null;
    void reconnectProbe();
  }, probeMs);
  probeTimer.unref?.();
};

const reconnectClient = async (client) => {
  if (!client || shuttingDown) return;
  if (client.status === "ready" || client.status === "connecting" || client.status === "reconnecting" || client.status === "connect") return;
  if (client.status === "wait" || client.status === "end") {
    await client.connect();
  }
};

const reconnectProbe = async () => {
  if (shuttingDown || status.mode !== "redis" || status.state === "ready") return;
  status.state = "reconnecting";
  const clients = [redis, ...companions].filter(Boolean);
  try {
    await Promise.all(clients.map((client) => reconnectClient(client).catch((error) => {
      status.lastError = error.message;
    })));
  } catch (error) {
    status.lastError = error.message;
  }
  if (status.state !== "ready") {
    status.state = "unavailable";
    scheduleProbe();
  }
};

const logDevUnavailable = () => {
  const detail = [
    `Redis is unavailable at ${status.target} (${status.source}).`,
    status.lastError || "The connection was refused or timed out.",
    "The API will keep running.",
    "Sessions, OTP, token revocation, rate limits, and job locks fail closed until Redis reconnects. They are not served from memory.",
    "Socket.IO stays on this process until Redis is ready.",
    "Start local Redis with: docker compose -f deploy/docker-compose.local.yml up -d redis",
    "Each laptop can point at its own Redis with REDIS_URL or REDIS_HOST, REDIS_PORT, and REDIS_PASSWORD.",
    "REDIS_ENABLED=false is the single-process memory store. Do not use it when more than one API process is running.",
    `Fast retries stop after ${env.REDIS_MAX_RECONNECT_ATTEMPTS} attempts. A probe then runs every ${probeMs}ms.`
  ].join(" ");
  console.error(`[BuiltGlory API] ${detail}`);
  logger.error({ message: "Redis unavailable", target: status.target, source: status.source, error: status.lastError, probeMs });
};

const attachClientLifecycle = (client) => {
  client.on("connect", () => {
    status.state = "connecting";
  });
  client.on("ready", () => {
    status.state = "ready";
    status.attempts = 0;
    status.lastError = null;
    lastLoggedError = "";
    clearProbe();
    logger.info({ message: "Redis ready", target: status.target, tls: status.target.startsWith("rediss:") });
    notifyReady();
  });
  client.on("reconnecting", (delay) => {
    status.state = "reconnecting";
    status.attempts += 1;
    if (status.attempts <= 3 || Number(delay) >= 5000) {
      logger.warn({ message: "Redis reconnecting", delayMs: delay, attempt: status.attempts, target: status.target });
    }
  });
  client.on("end", () => {
    if (shuttingDown) {
      status.state = "closed";
      return;
    }
    status.state = "unavailable";
    logger.warn({ message: "Redis fast retry stopped", target: status.target, attempts: status.attempts });
    scheduleProbe();
  });
  client.on("error", (error) => {
    const message = error?.message || "unknown redis error";
    status.lastError = message;
    if (message === lastLoggedError) return;
    lastLoggedError = message;
    logger.error({ message: "Redis error", error: message, target: status.target, code: error?.code || error?.name });
  });
};

const memoryClient = () => ({
  status: "ready",
  async get(key) {
    const row = memory.get(key);
    if (!row) return null;
    if (row.expiresAt && row.expiresAt < Date.now()) {
      memory.delete(key);
      return null;
    }
    return row.value;
  },
  async set(key, value, mode, ttl, nx) {
    if (nx === "NX") {
      const current = memory.get(key);
      if (current && !(current.expiresAt && current.expiresAt < Date.now())) return null;
    }
    memory.set(key, { value, expiresAt: mode === "EX" ? Date.now() + ttl * 1000 : null });
    return "OK";
  },
  async del(...keys) {
    let removed = 0;
    for (const key of keys) {
      if (memory.delete(key)) removed += 1;
    }
    return removed;
  },
  async incr(key) {
    const row = memory.get(key);
    if (row?.expiresAt && row.expiresAt < Date.now()) memory.delete(key);
    const current = Number(memory.get(key)?.value || 0);
    const next = current + 1;
    const expiresAt = memory.get(key)?.expiresAt ?? null;
    memory.set(key, { value: String(next), expiresAt });
    return next;
  },
  async decr(key) {
    const row = memory.get(key);
    if (row?.expiresAt && row.expiresAt < Date.now()) memory.delete(key);
    const current = Number(memory.get(key)?.value || 0);
    const next = current - 1;
    const expiresAt = memory.get(key)?.expiresAt ?? null;
    memory.set(key, { value: String(next), expiresAt });
    return next;
  },
  async expire(key, ttlSeconds) {
    const row = memory.get(key);
    if (!row) return 0;
    row.expiresAt = Date.now() + ttlSeconds * 1000;
    return 1;
  },
  async pexpire(key, ttlMs) {
    const row = memory.get(key);
    if (!row) return 0;
    row.expiresAt = Date.now() + ttlMs;
    return 1;
  },
  async pttl(key) {
    const row = memory.get(key);
    if (!row) return -2;
    if (!row.expiresAt) return -1;
    return Math.max(0, row.expiresAt - Date.now());
  },
  async ping() {
    return "PONG";
  }
});

export const getRedis = () => {
  if (status.mode === "memory") return memoryClient();
  if (redis) return redis;
  if (resolved.error) {
    throw new Error(resolved.error);
  }
  if (isProdLike) {
    if (resolved.mode !== "redis") {
      throw new Error("Redis is required in production/staging. Set REDIS_URL or REDIS_HOST.");
    }
  }

  redis = new Redis(
    resolved.url,
    buildRedisOptions(resolved.url, {
      tlsRejectUnauthorized: env.REDIS_TLS_REJECT_UNAUTHORIZED !== false,
      maxRetriesPerRequest: 2,
      connectTimeout: env.REDIS_CONNECT_TIMEOUT_MS,
      maxReconnectAttempts: env.REDIS_MAX_RECONNECT_ATTEMPTS,
      password: resolved.password || undefined,
      shouldStop: () => shuttingDown || stopRetrying
    })
  );
  attachClientLifecycle(redis);
  return redis;
};

export const trackRedisClient = (client) => {
  if (!client || status.mode !== "redis") return client;
  companions.add(client);
  client.on("error", (error) => {
    const message = error?.message || "unknown redis error";
    status.lastError = message;
    logger.error({ message: "Redis companion error", error: message, target: status.target });
  });
  client.on("end", () => {
    if (!shuttingDown) scheduleProbe();
  });
  return client;
};

export const connectRedis = async () => {
  if (resolved.error) {
    throw new Error(`Redis configuration is invalid: ${resolved.error}`);
  }
  if (status.mode === "memory") {
    if (isProdLike) {
      throw new Error("Redis is required in production/staging. Set REDIS_URL or REDIS_HOST, REDIS_PORT, and REDIS_PASSWORD. REDIS_ENABLED=false is not allowed. In-memory sessions are not allowed.");
    }
    status.state = "memory";
    const detail = `Redis is not configured (${status.source}). Using the single-process memory store for sessions, OTP, rate limits, and locks. Set REDIS_URL or REDIS_HOST before running more than one API process.`;
    console.warn(`[BuiltGlory API] ${detail}`);
    logger.warn({ message: "Redis disabled; in-memory store active", source: status.source });
    return getRedisStatus();
  }

  const client = getRedis();
  if (client.status === "ready") {
    status.state = "ready";
    return getRedisStatus();
  }

  status.state = "connecting";
  logger.info({
    message: "Connecting to Redis",
    target: status.target,
    source: status.source,
    timeoutMs: env.REDIS_CONNECT_TIMEOUT_MS,
    maxAttempts: env.REDIS_MAX_RECONNECT_ATTEMPTS
  });

  try {
    if (client.status === "wait" || client.status === "end") {
      await client.connect();
    }
    status.state = "ready";
    status.lastError = null;
    console.log(`[BuiltGlory API] Redis ready at ${status.target}`);
  } catch (error) {
    status.lastError = status.lastError || error.message;
    status.state = client.status === "end" ? "unavailable" : "reconnecting";
    if (isProdLike) {
      stopRetrying = true;
      clearProbe();
      try {
        client.disconnect();
      } catch {
        // The startup error below is the diagnostic that matters.
      }
      throw new Error(
        `Redis connection failed at ${status.target} (${status.source}): ${status.lastError}. Check REDIS_URL or REDIS_HOST, REDIS_PORT, and REDIS_PASSWORD, and confirm this machine can reach Redis. Production and staging cannot start without Redis because sessions, OTP, rate limits, and job locks depend on it.`
      );
    }
    logDevUnavailable();
  }
  return getRedisStatus();
};

const assertOptionalCacheKey = (key) => {
  if (CRITICAL_CACHE_PREFIX.test(String(key))) {
    throw new Error("Refusing to use the optional cache for a session, lock, OTP, or rate-limit key.");
  }
};

const readLocalOptional = (key) => {
  const row = localOptionalCache.get(key);
  if (!row) return null;
  if (row.expiresAt && row.expiresAt <= Date.now()) {
    localOptionalCache.delete(key);
    return null;
  }
  return row.value;
};

/**
 * Non-critical cache only. Critical locks, sessions, OTP, and rate limits must use getRedis().
 * When Redis is configured but down, this falls back to process memory and does not throw.
 */
export const optionalCacheGet = async (key) => {
  assertOptionalCacheKey(key);
  if (isRedisReady()) {
    try {
      return await getRedis().get(key);
    } catch (error) {
      if (!isRedisDependencyError(error)) throw error;
    }
  }
  return readLocalOptional(key);
};

export const optionalCacheSet = async (key, value, ttlSeconds = 60) => {
  assertOptionalCacheKey(key);
  const payload = String(value);
  if (isRedisReady()) {
    try {
      return await getRedis().set(key, payload, "EX", ttlSeconds);
    } catch (error) {
      if (!isRedisDependencyError(error)) throw error;
    }
  }
  localOptionalCache.set(key, { value: payload, expiresAt: Date.now() + ttlSeconds * 1000 });
  if (!optionalCacheFallbackLogged) {
    optionalCacheFallbackLogged = true;
    logger.warn({ message: "Optional cache is using process memory because Redis is unavailable", target: status.target });
  }
  return "OK";
};

export const closeRedis = async () => {
  shuttingDown = true;
  stopRetrying = true;
  clearProbe();
  readyListeners.clear();
  const extras = [...companions];
  companions.clear();
  for (const extra of extras) {
    try {
      await extra.quit();
    } catch {
      extra.disconnect?.();
    }
  }
  if (!redis) {
    status.state = status.mode === "memory" ? "memory" : "closed";
    return;
  }
  const client = redis;
  redis = undefined;
  status.state = "closed";
  try {
    await client.quit();
  } catch {
    client.disconnect();
  }
};
