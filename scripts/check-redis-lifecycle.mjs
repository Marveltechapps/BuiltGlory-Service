/**
 * Proves a refused Redis port does not kill the process.
 * Critical locks do not run. Optional cache falls back to memory.
 * Run: node scripts/check-redis-lifecycle.mjs
 */
process.env.NODE_ENV = "development";
process.env.REDIS_ENABLED = "true";
process.env.REDIS_URL = process.env.REDIS_LIFECYCLE_URL || "redis://127.0.0.1:6399";
process.env.REDIS_HOST = "";
process.env.REDIS_PASSWORD = "";
process.env.REDIS_MAX_RECONNECT_ATTEMPTS = process.env.REDIS_MAX_RECONNECT_ATTEMPTS || "2";
process.env.REDIS_RECONNECT_PROBE_MS = process.env.REDIS_RECONNECT_PROBE_MS || "5000";
process.env.REDIS_CONNECT_TIMEOUT_MS = process.env.REDIS_CONNECT_TIMEOUT_MS || "1000";

const withTimeout = (promise, ms, label) => Promise.race([
  promise,
  new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms).unref?.();
  })
]);

const main = async () => {
  const redis = await import("../src/config/redis.js");
  const { withJobLock } = await import("../src/services/jobLock.service.js");
  const status = await withTimeout(redis.connectRedis(), 8000, "connectRedis");
  if (status.mode !== "redis") throw new Error(`expected redis mode, got ${status.mode}`);
  if (status.state === "ready") throw new Error(`expected Redis at ${status.target} to be down`);
  if (!status.target || status.target.includes("@")) throw new Error("target leaked credentials or was empty");

  await redis.optionalCacheSet("cache:lifecycle", "ok", 30);
  const cached = await redis.optionalCacheGet("cache:lifecycle");
  if (cached !== "ok") throw new Error(`optional cache fallback returned ${cached}`);
  await expectRejection(redis.optionalCacheSet("session:lifecycle", "no"));

  let ran = false;
  const lock = await withTimeout(withJobLock("lifecycle", async () => {
    ran = true;
    return { ran: true };
  }), 8000, "job lock");
  if (ran) throw new Error("job lock ran while Redis was unavailable");
  if (lock?.reason !== "redis_unavailable") throw new Error(`expected redis_unavailable, got ${JSON.stringify(lock)}`);

  await redis.closeRedis();
  const line = JSON.stringify({
    pass: true,
    state: status.state,
    target: status.target,
    error: status.lastError
  });
  await new Promise((resolve) => {
    process.stdout.write(`REDIS_LIFECYCLE ${line}\n`, () => resolve());
  });
  process.exit(0);
};

const expectRejection = async (promise) => {
  try {
    await promise;
  } catch (error) {
    if (/optional cache/i.test(error.message)) return;
    throw error;
  }
  throw new Error("critical cache key was accepted by the optional cache");
};

main().catch((error) => {
  console.error(JSON.stringify({ pass: false, error: error.message }));
  process.exit(1);
});
