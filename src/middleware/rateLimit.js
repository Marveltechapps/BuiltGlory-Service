import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { env } from "../config/env.js";
import { getRedis } from "../config/redis.js";

const isDev = env.NODE_ENV === "development" || env.NODE_ENV === "test";

function rateLimitJsonHandler(req, res, next, options) {
  res.status(options.statusCode).json({
    error: {
      code: "RATE_LIMITED",
      message: typeof options.message === "string" ? options.message : "Too many requests. Please try again later.",
      details: []
    },
    meta: { requestId: res.locals.requestId }
  });
}

/**
 * Distributed rate-limit store. Used whenever Redis is configured.
 * Store errors propagate (passOnStoreError is false) so a Redis outage cannot skip the limit.
 * The in-memory store is used only when Redis is explicitly disabled or unset.
 */
const createRedisStore = (prefix) => {
  if (!env.REDIS_URL) return undefined;
  const windowMsByPrefix = new Map();
  return {
    prefix,
    init(options) {
      windowMsByPrefix.set(prefix, options.windowMs);
    },
    async increment(key) {
      const redis = getRedis();
      const redisKey = `${prefix}${key}`;
      const totalHits = await redis.incr(redisKey);
      const windowMs = windowMsByPrefix.get(prefix) || 15 * 60 * 1000;
      if (totalHits === 1 && typeof redis.pexpire === "function") {
        await redis.pexpire(redisKey, windowMs);
      } else if (totalHits === 1 && typeof redis.expire === "function") {
        await redis.expire(redisKey, Math.ceil(windowMs / 1000));
      }
      const ttlMs = typeof redis.pttl === "function" ? await redis.pttl(redisKey) : windowMs;
      const resetTime = new Date(Date.now() + (ttlMs > 0 ? ttlMs : windowMs));
      return { totalHits, resetTime };
    },
    async decrement(key) {
      const redis = getRedis();
      const redisKey = `${prefix}${key}`;
      const value = await redis.decr?.(redisKey);
      if (value !== undefined && value < 0 && typeof redis.set === "function") {
        await redis.set(redisKey, "0");
      }
    },
    async resetKey(key) {
      const redis = getRedis();
      await redis.del(`${prefix}${key}`);
    }
  };
};

const baseOptions = {
  standardHeaders: true,
  legacyHeaders: false,
  passOnStoreError: false,
  handler: rateLimitJsonHandler
};

export const generalLimiter = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000,
  // Local Expo/device testing burns through a shared IP budget quickly (polling + retries).
  max: isDev ? 100000 : 1000,
  skip: (req) => isDev || req.path === "/" || req.path === "/health",
  store: createRedisStore("rl:general:")
});

export const authLimiter = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000,
  max: isDev ? 200 : 25,
  store: createRedisStore("rl:auth:")
});

// Refresh is called for every expired access token. Keep it off the tight login bucket
// so an office NAT does not log the whole team out.
export const refreshLimiter = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000,
  max: isDev ? 100000 : 600,
  store: createRedisStore("rl:refresh:")
});

export const otpLimiter = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000,
  // Test suites issue hundreds of OTP sends from one IP; production stays tight.
  max: isDev ? 100000 : 8,
  skip: () => env.NODE_ENV === "test",
  // Key by IP (not raw phone) so an attacker cannot burn a victim's OTP budget (OBS-05).
  keyGenerator: (req) => ipKeyGenerator(req.ip),
  store: createRedisStore("rl:otp:")
});

export const emailOtpLimiter = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000,
  max: isDev ? 30 : 6,
  keyGenerator: (req) => req.body?.email || ipKeyGenerator(req.ip),
  store: createRedisStore("rl:email-otp:")
});

export const uploadLimiter = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000,
  max: isDev ? 500 : 50,
  store: createRedisStore("rl:upload:")
});
