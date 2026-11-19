import { assertProductionRedisUrl, buildRedisOptions, isRedisTlsUrl } from "../config/redisOptions.js";

describe("redisOptions", () => {
  test("detects rediss TLS URLs", () => {
    expect(isRedisTlsUrl("rediss://default:pass@host:6379")).toBe(true);
    expect(isRedisTlsUrl("redis://127.0.0.1:6379")).toBe(false);
  });

  test("buildRedisOptions enables tls for rediss", () => {
    const opts = buildRedisOptions("rediss://example:6379");
    expect(opts.tls).toEqual({ rejectUnauthorized: true });
    expect(typeof opts.retryStrategy).toBe("function");
    expect(opts.retryStrategy(1)).toBe(200);
    expect(opts.retryStrategy(100)).toBeNull();
    expect(opts.reconnectOnError({ message: "READONLY You can't write against a read only replica" })).toBe(true);
  });

  test("production requires managed rediss URL", () => {
    expect(() => assertProductionRedisUrl("redis://127.0.0.1:6379", "production")).toThrow(/rediss/);
    expect(() => assertProductionRedisUrl("rediss://127.0.0.1:6379", "production")).toThrow(/localhost/);
    expect(assertProductionRedisUrl("rediss://default:x@cache.example.com:6379", "production")).toMatch(/^rediss:/);
  });

  test("staging allows non-TLS redis for internal networks", () => {
    expect(assertProductionRedisUrl("redis://redis.internal:6379", "staging")).toMatch(/^redis:/);
  });
});
