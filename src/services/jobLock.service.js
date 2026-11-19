import { getRedis } from "../config/redis.js";

export const withJobLock = async (name, work, ttlSeconds = 300) => {
  const redis = getRedis();
  const key = `job:lock:${name}`;
  const acquired = await redis.set(key, String(Date.now()), "EX", ttlSeconds, "NX");
  if (acquired !== "OK") return { skipped: true, reason: "locked" };
  try {
    return await work();
  } finally {
    await redis.del(key);
  }
};
