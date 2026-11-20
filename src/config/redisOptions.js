/**
 * Shared Redis target resolution and ioredis options.
 * Host, port, password, and URL come from the environment. Nothing here is machine-specific.
 */

const looksLocal = (value = "") => /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(String(value));

export const isRedisTlsUrl = (url = "") => /^rediss:\/\//i.test(String(url).trim());

export const describeRedisTarget = (url = "") => {
  try {
    const parsed = new URL(String(url).trim());
    const protocol = parsed.protocol.replace(":", "") || "redis";
    const port = parsed.port || "6379";
    const db = parsed.pathname && parsed.pathname !== "/" ? parsed.pathname : "";
    return `${protocol}://${parsed.hostname}:${port}${db}`;
  } catch {
    return "invalid-redis-target";
  }
};

const parseEnabled = (value) => {
  if (value === true || value === false) return value;
  if (value === undefined || value === null || value === "") return undefined;
  const text = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(text)) return true;
  if (["0", "false", "no", "off"].includes(text)) return false;
  return value;
};

/**
 * Resolve the Redis connection from environment fields.
 * REDIS_URL wins. Otherwise the URL is built from REDIS_HOST, REDIS_PORT, and REDIS_PASSWORD.
 * REDIS_ENABLED=false selects the single-process memory store and does not open a socket.
 *
 * @param {Record<string, unknown>} input
 */
export const resolveRedisConnection = (input = {}) => {
  const enabled = parseEnabled(input.REDIS_ENABLED);
  if (enabled !== undefined && typeof enabled !== "boolean") {
    return { error: "REDIS_ENABLED must be true or false." };
  }

  const explicitUrl = String(input.REDIS_URL || "").trim();
  const host = String(input.REDIS_HOST || "").trim();
  const port = Number(input.REDIS_PORT || 6379);
  const password = String(input.REDIS_PASSWORD || "");

  let url = explicitUrl;
  let source = explicitUrl ? "REDIS_URL" : "";
  if (!url && host) {
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return { error: "REDIS_PORT must be an integer from 1 to 65535." };
    }
    const auth = password ? `:${encodeURIComponent(password)}@` : "";
    url = `redis://${auth}${host}:${port}`;
    source = "REDIS_HOST";
  }

  if (enabled === false) {
    return {
      mode: "memory",
      configured: false,
      url: "",
      target: "",
      source: "REDIS_ENABLED=false",
      password: ""
    };
  }

  if (!url) {
    if (enabled === true) {
      return { error: "REDIS_ENABLED=true requires REDIS_URL or REDIS_HOST." };
    }
    return {
      mode: "memory",
      configured: false,
      url: "",
      target: "",
      source: "unset",
      password: ""
    };
  }

  if (!/^redis(s)?:\/\//i.test(url)) {
    return { error: "REDIS_URL must use redis:// or rediss://." };
  }

  let passwordOption = "";
  if (password) {
    try {
      const parsed = new URL(url);
      if (!parsed.password) passwordOption = password;
    } catch {
      return { error: "REDIS_URL is not a valid URL." };
    }
  }

  return {
    mode: "redis",
    configured: true,
    url,
    target: describeRedisTarget(url),
    source,
    password: passwordOption
  };
};

export const assertProductionRedisUrl = (url, nodeEnv = "production") => {
  const value = String(url || "").trim();
  if (!value) {
    throw new Error("REDIS_URL or REDIS_HOST is required in production/staging (in-memory sessions are not allowed).");
  }
  if (!/^redis(s)?:\/\//i.test(value)) {
    throw new Error("REDIS_URL must use redis:// or rediss://");
  }
  if (nodeEnv === "production") {
    if (!isRedisTlsUrl(value)) {
      throw new Error("REDIS_URL must use rediss:// (TLS) in production.");
    }
    if (looksLocal(value)) {
      throw new Error("REDIS_URL must not point at localhost in production.");
    }
  }
  return value;
};

const localHostname = (url = "") => {
  try {
    return new URL(String(url).trim()).hostname;
  } catch {
    return "";
  }
};

/**
 * Exponential backoff with a hard stop. Returning null ends the fast retry loop.
 * A slower probe in redis.js continues afterwards so Redis can come back.
 *
 * @param {string} url
 * @param {{ tlsRejectUnauthorized?: boolean, maxRetriesPerRequest?: number, connectTimeout?: number, maxReconnectAttempts?: number, password?: string, shouldStop?: () => boolean }} [opts]
 */
export const buildRedisOptions = (url, opts = {}) => {
  const tls = isRedisTlsUrl(url)
    ? {
        rejectUnauthorized: opts.tlsRejectUnauthorized !== false
      }
    : undefined;
  const hostname = localHostname(url);
  const family = hostname === "localhost" || hostname === "127.0.0.1" ? 4 : undefined;
  const maxAttempts = opts.maxReconnectAttempts ?? 8;

  return {
    ...(opts.password ? { password: opts.password } : {}),
    ...(family ? { family } : {}),
    maxRetriesPerRequest: opts.maxRetriesPerRequest ?? 2,
    enableReadyCheck: true,
    enableOfflineQueue: true,
    connectTimeout: opts.connectTimeout ?? 10_000,
    lazyConnect: true,
    connectionName: "builtglory-api",
    tls,
    retryStrategy(times) {
      if (typeof opts.shouldStop === "function" && opts.shouldStop()) return null;
      if (times > maxAttempts) return null;
      return Math.min(200 * (2 ** (times - 1)), 15_000);
    },
    reconnectOnError(err) {
      const message = String(err?.message || "");
      if (/READONLY|ECONNRESET|ETIMEDOUT|EPIPE|NR_CLOSED/i.test(message)) return true;
      return false;
    }
  };
};
