/**
 * Shared ioredis option builder for app + deploy scripts.
 * Supports redis:// (dev) and rediss:// (managed TLS).
 */

const looksLocal = (value = "") => /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(String(value));

export const isRedisTlsUrl = (url = "") => /^rediss:\/\//i.test(String(url).trim());

export const assertProductionRedisUrl = (url, nodeEnv = "production") => {
  const value = String(url || "").trim();
  if (!value) {
    throw new Error("REDIS_URL is required in production/staging (in-memory sessions are not allowed).");
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

/**
 * @param {string} url
 * @param {{ tlsRejectUnauthorized?: boolean, maxRetriesPerRequest?: number, connectTimeout?: number }} [opts]
 */
export const buildRedisOptions = (url, opts = {}) => {
  const tls = isRedisTlsUrl(url)
    ? {
        rejectUnauthorized: opts.tlsRejectUnauthorized !== false
      }
    : undefined;

  return {
    maxRetriesPerRequest: opts.maxRetriesPerRequest ?? 2,
    enableReadyCheck: true,
    connectTimeout: opts.connectTimeout ?? 10_000,
    lazyConnect: false,
    tls,
    retryStrategy(times) {
      const maxAttempts = opts.maxReconnectAttempts ?? 25;
      if (times > maxAttempts) return null;
      return Math.min(times * 200, 3000);
    },
    reconnectOnError(err) {
      const message = String(err?.message || "");
      // Reconnect on READONLY (failover) and common transient socket failures.
      if (/READONLY|ECONNRESET|ETIMEDOUT|EPIPE|NR_CLOSED/i.test(message)) return true;
      return false;
    }
  };
};
