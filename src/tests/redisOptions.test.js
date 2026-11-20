import { assertProductionRedisUrl, buildRedisOptions, describeRedisTarget, isRedisTlsUrl, resolveRedisConnection } from "../config/redisOptions.js";

describe("redisOptions", () => {
  test("detects rediss TLS URLs", () => {
    expect(isRedisTlsUrl("rediss://default:pass@host:6379")).toBe(true);
    expect(isRedisTlsUrl("redis://127.0.0.1:6379")).toBe(false);
  });

  test("buildRedisOptions enables tls for rediss and backs off without a tight loop", () => {
    const opts = buildRedisOptions("rediss://example:6379");
    expect(opts.tls).toEqual({ rejectUnauthorized: true });
    expect(opts.lazyConnect).toBe(true);
    expect(opts.connectTimeout).toBe(10_000);
    expect(opts.retryStrategy(1)).toBe(200);
    expect(opts.retryStrategy(2)).toBe(400);
    expect(opts.retryStrategy(3)).toBe(800);
    expect(opts.retryStrategy(8)).toBe(15_000);
    expect(opts.retryStrategy(9)).toBeNull();
    expect(opts.retryStrategy(100)).toBeNull();
    expect(opts.reconnectOnError({ message: "READONLY You can't write against a read only replica" })).toBe(true);
  });

  test("local redis uses IPv4 so Windows does not prefer ::1", () => {
    expect(buildRedisOptions("redis://127.0.0.1:6379").family).toBe(4);
    expect(buildRedisOptions("redis://localhost:6379").family).toBe(4);
    expect(buildRedisOptions("rediss://cache.example:6379").family).toBeUndefined();
  });

  test("production requires managed rediss URL", () => {
    expect(() => assertProductionRedisUrl("redis://127.0.0.1:6379", "production")).toThrow(/rediss/);
    expect(() => assertProductionRedisUrl("rediss://127.0.0.1:6379", "production")).toThrow(/localhost/);
    expect(assertProductionRedisUrl("rediss://default:x@cache.example.com:6379", "production")).toMatch(/^rediss:/);
  });

  test("staging allows non-TLS redis for internal networks", () => {
    expect(assertProductionRedisUrl("redis://redis.internal:6379", "staging")).toMatch(/^redis:/);
  });

  test("builds a URL from host, port, and password without keeping the password in the description", () => {
    const resolved = resolveRedisConnection({
      REDIS_ENABLED: "true",
      REDIS_HOST: "redis.internal",
      REDIS_PORT: "6380",
      REDIS_PASSWORD: "secret"
    });
    expect(resolved.mode).toBe("redis");
    expect(resolved.source).toBe("REDIS_HOST");
    expect(resolved.url).toBe("redis://:secret@redis.internal:6380");
    expect(resolved.target).toBe("redis://redis.internal:6380");
    expect(describeRedisTarget("redis://:secret@127.0.0.1:6379/2")).toBe("redis://127.0.0.1:6379/2");
  });

  test("REDIS_URL wins over host, and disabling Redis selects memory", () => {
    const fromUrl = resolveRedisConnection({
      REDIS_URL: "redis://10.0.0.8:6379",
      REDIS_HOST: "127.0.0.1",
      REDIS_PORT: "6380"
    });
    expect(fromUrl.target).toBe("redis://10.0.0.8:6379");
    expect(fromUrl.source).toBe("REDIS_URL");
    expect(resolveRedisConnection({ REDIS_ENABLED: "false", REDIS_URL: "redis://127.0.0.1:6379" }).mode).toBe("memory");
    expect(resolveRedisConnection({}).mode).toBe("memory");
    expect(resolveRedisConnection({ REDIS_ENABLED: "true" }).error).toMatch(/REDIS_HOST/);
  });
});
