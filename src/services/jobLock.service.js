import { getRedis, getRedisStatus, isRedisDependencyError } from "../config/redis.js";
import { logger } from "../config/logger.js";

export const withJobLock = async (name, work, ttlSeconds = 300) => {
  const redis = getRedis();
  const key = `job:lock:${name}`;
  let acquired;
  try {
    acquired = await redis.set(key, String(Date.now()), "EX", ttlSeconds, "NX");
  } catch (error) {
    if (!isRedisDependencyError(error)) throw error;
    logger.error({
      message: "Job not started because the Redis lock is unavailable",
      job: name,
      error: error.message,
      target: getRedisStatus().target
    });
    return { skipped: true, reason: "redis_unavailable" };
  }
  if (acquired !== "OK") return { skipped: true, reason: "locked" };
  try {
    return await work();
  } finally {
    try {
      await redis.del(key);
    } catch (error) {
      logger.error({ message: "Job lock release failed", job: name, error: error.message });
    }
  }
};
