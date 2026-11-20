/**
 * Starts the API against a disposable MongoDB and a disposable Redis.
 * Does not use the developer .env database or the Redis instance on 6379.
 *
 * node scripts/check-redis-startup.mjs
 */
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MongoMemoryServer } from "mongodb-memory-server";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const findRedisExe = () => {
  if (process.env.REDIS_SERVER_EXE) return process.env.REDIS_SERVER_EXE;
  try {
    const found = execFileSync("where.exe", ["redis-server"], { encoding: "utf8" })
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean);
    if (found) return found;
  } catch {
    // Redis is optional for this check. The API itself does not shell out to it.
  }
  return "";
};
const redisExe = findRedisExe();
const redisPort = 6398;
const redact = (text = "") => String(text).replace(/mongodb(\+srv)?:\/\/\S+/gi, "mongodb://redacted");

const runNode = (args, env) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, args, { cwd: root, env: { ...process.env, ...env }, windowsHide: true });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
  child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
  child.on("error", reject);
  child.on("exit", (code) => resolve({ code, stdout, stderr }));
});

if (process.argv.includes("--production")) {
  process.env.NODE_ENV = "production";
  process.env.MONGODB_URI = "mongodb+srv://user:pass@cluster.example.net/builtglory";
  process.env.REDIS_ENABLED = "true";
  process.env.REDIS_URL = "redis://127.0.0.1:6379";
  process.env.REDIS_HOST = "";
  process.env.JWT_ACCESS_SECRET = "production-access-secret-value-0123456789";
  process.env.JWT_REFRESH_SECRET = "production-refresh-secret-value-0123456789";
  process.env.JWT_ISSUER = "builtglory-api";
  process.env.JWT_AUDIENCE = "builtglory-clients";
  process.env.CORS_ORIGINS = "https://app.example.com";
  process.env.APP_PUBLIC_URL = "https://app.example.com";
  process.env.EMAIL_TRANSPORT = "ses";
  try {
    await import("../src/config/env.js");
    console.error("production env accepted a local redis:// URL");
    process.exit(1);
  } catch (error) {
    if (!/rediss:\/\/|localhost/i.test(error.message)) {
      console.error(redact(error.message));
      process.exit(1);
    }
    console.log("PRODUCTION_CHECK redis rejected");
    process.exit(0);
  }
}

if (process.argv.includes("--mongo-down")) {
  process.env.NODE_ENV = "development";
  process.env.MONGODB_URI = "mongodb://127.0.0.1:1/builtglory";
  process.env.REDIS_ENABLED = "false";
  process.env.REDIS_URL = "";
  const { connectDatabase } = await import("../src/database/connection.js");
  try {
    await connectDatabase();
    console.error("mongo connection unexpectedly succeeded");
    process.exit(1);
  } catch (error) {
    if (!/MongoDB connection failed/i.test(error.message) || !/ECONNREFUSED|127\.0\.0\.1/i.test(error.message)) {
      console.error(redact(error.message));
      process.exit(1);
    }
    console.log("MONGO_CHECK clear diagnostic");
    process.exit(0);
  }
}

if (process.argv.includes("--reconnect")) {
  process.env.NODE_ENV = "development";
  process.env.REDIS_ENABLED = "true";
  process.env.REDIS_URL = "";
  process.env.REDIS_HOST = "127.0.0.1";
  process.env.REDIS_PORT = String(redisPort);
  process.env.REDIS_PASSWORD = "";
  process.env.REDIS_MAX_RECONNECT_ATTEMPTS = "2";
  process.env.REDIS_RECONNECT_PROBE_MS = "500";
  process.env.REDIS_CONNECT_TIMEOUT_MS = "1000";
  const redis = await import("../src/config/redis.js");
  const { withJobLock } = await import("../src/services/jobLock.service.js");
  const status = await redis.connectRedis();
  if (status.state !== "ready") throw new Error(`redis did not become ready: ${status.state} ${status.lastError || ""}`);
  let ran = false;
  const lock = await withJobLock("startup-check", async () => {
    ran = true;
    return "done";
  });
  if (!ran || lock === undefined) throw new Error(`job lock did not run: ${JSON.stringify(lock)}`);
  await redis.optionalCacheSet("cache:startup", "ready", 30);
  if (await redis.optionalCacheGet("cache:startup") !== "ready") throw new Error("optional cache miss while Redis was ready");
  console.log("REDIS_READY");
  const started = Date.now();
  let sawOutage = false;
  while (Date.now() - started < 20_000) {
    const state = redis.getRedisStatus().state;
    if (state !== "ready") {
      sawOutage = true;
      break;
    }
    try {
      await Promise.race([
        redis.getRedis().ping(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("ping timeout")), 1000))
      ]);
    } catch {
      sawOutage = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  if (!sawOutage) throw new Error("redis stayed ready after the server was stopped");
  console.log("REDIS_DOWN");
  const again = Date.now();
  let pong = "";
  while (Date.now() - again < 20_000) {
    try {
      pong = await redis.getRedis().ping();
      if (pong === "PONG" && redis.getRedisStatus().state === "ready") break;
    } catch {
      // The probe has not reconnected yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  if (pong !== "PONG") throw new Error(`redis did not reconnect: ${redis.getRedisStatus().state} ${redis.getRedisStatus().lastError || ""}`);
  console.log("REDIS_BACK");
  await redis.getRedis().del("cache:startup");
  await redis.closeRedis();
  process.exit(0);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const startRedis = (dir) => {
  if (!redisExe) throw new Error("redis-server was not found on PATH. Set REDIS_SERVER_EXE to run this check.");
  const configPath = path.join(dir, "redis.conf");
  const dirPosix = dir.replace(/\\/g, "/");
  fs.writeFileSync(configPath, [
    `port ${redisPort}`,
    "bind 127.0.0.1",
    "appendonly no",
    `dir ${dirPosix}`,
    "dbfilename lifecycle.rdb",
    'save ""'
  ].join("\n"));
  return spawn(redisExe, [configPath], { cwd: dir, windowsHide: true, stdio: "ignore" });
};

const waitForExit = (child) => new Promise((resolve) => {
  if (child.exitCode !== null || child.signalCode) {
    resolve();
    return;
  }
  child.once("exit", () => resolve());
});

const stopProcess = async (child) => {
  if (!child || child.exitCode !== null) return;
  child.kill();
  await Promise.race([waitForExit(child), sleep(3000)]);
  if (child.exitCode === null) {
    spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
    await Promise.race([waitForExit(child), sleep(3000)]);
  }
};

const waitForTcp = async (port, timeoutMs) => {
  const net = await import("node:net");
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const open = await new Promise((resolve) => {
      const socket = net.connect({ host: "127.0.0.1", port });
      const done = (value) => {
        socket.removeAllListeners();
        socket.destroy();
        resolve(value);
      };
      socket.once("connect", () => done(true));
      socket.once("error", () => done(false));
    });
    if (open) return;
    await sleep(100);
  }
  throw new Error(`redis ${port} did not accept connections`);
};

const startApi = (mongoUri, redisUrl, port) => {
  const child = spawn(process.execPath, ["src/server.js"], {
    cwd: root,
    windowsHide: true,
    env: {
      ...process.env,
      NODE_ENV: "development",
      PORT: String(port),
      MONGODB_URI: mongoUri,
      REDIS_ENABLED: "true",
      REDIS_URL: redisUrl,
      REDIS_HOST: "",
      REDIS_PASSWORD: "",
      REDIS_MAX_RECONNECT_ATTEMPTS: "2",
      REDIS_RECONNECT_PROBE_MS: "15000",
      REDIS_CONNECT_TIMEOUT_MS: "1000",
      SMS_DELIVERY_MODE: "log",
      SMS_VENDOR_URL: "",
      SMS_PROVIDER_URL: ""
    }
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk.toString(); });
  child.stderr.on("data", (chunk) => { output += chunk.toString(); });
  child.output = () => redact(output);
  return child;
};

const waitForReadyLine = async (child, timeoutMs) => {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (child.exitCode !== null) throw new Error(`API exited ${child.exitCode}\n${child.output()}`);
    const match = child.output().match(/BuiltGlory API running on port (\d+)/);
    if (match) return Number(match[1]);
    await sleep(200);
  }
  throw new Error(`API did not report a port\n${child.output()}`);
};

const request = async (port, method, pathname, body) => {
  const response = await fetch(`http://127.0.0.1:${port}${pathname}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 200) }; }
  return { status: response.status, json };
};

const assertAlive = (child, label) => {
  if (child.exitCode !== null) throw new Error(`${label} crashed with exit ${child.exitCode}\n${child.output()}`);
};

const main = async () => {
  const production = await runNode(["scripts/check-redis-startup.mjs", "--production"], { NODE_ENV: "development" });
  if (production.code !== 0 || !production.stdout.includes("PRODUCTION_CHECK redis rejected")) {
    throw new Error(`production check failed\n${production.stdout}\n${redact(production.stderr)}`);
  }

  const mongoDown = await runNode(["scripts/check-redis-startup.mjs", "--mongo-down"], { NODE_ENV: "development" });
  if (mongoDown.code !== 0 || !mongoDown.stdout.includes("MONGO_CHECK clear diagnostic")) {
    throw new Error(`mongo diagnostic failed\n${mongoDown.stdout}\n${redact(mongoDown.stderr)}`);
  }

  const mongo = await MongoMemoryServer.create();
  const mongoUri = mongo.getUri();
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "bg-redis-"));
  let redisProcess;
  let downApi;
  let upApi;
  let reconnect;
  try {
    downApi = startApi(mongoUri, "redis://127.0.0.1:6399", 5091);
    const downPort = await waitForReadyLine(downApi, 40_000);
    await sleep(500);
    assertAlive(downApi, "redis-down api");
    const health = await request(downPort, "GET", "/health");
    const ready = await request(downPort, "GET", "/ready");
    const otp = await request(downPort, "POST", "/api/v1/auth/customer/otp/send", {
      countryCode: "+91",
      phone: "9999999999",
      purpose: "login"
    });
    assertAlive(downApi, "redis-down api after requests");
    if (health.status !== 200) throw new Error(`health ${health.status}`);
    if (ready.status !== 503 || ready.json?.checks?.redis !== "unavailable") {
      throw new Error(`ready was ${ready.status} ${JSON.stringify(ready.json?.checks || ready.json)}`);
    }
    if (otp.status !== 503 || otp.json?.error?.code !== "SERVICE_UNAVAILABLE") {
      throw new Error(`otp was not fail-closed: ${otp.status} ${otp.json?.error?.code || ""}`);
    }
    if (!downApi.output().includes("Redis is unavailable at redis://127.0.0.1:6399")) {
      throw new Error("startup log did not name the Redis target");
    }
    console.log("STARTUP_DOWN health=200 ready=503 otp=503 process=alive");
    await stopProcess(downApi);
    downApi = undefined;

    redisProcess = startRedis(dir);
    await waitForTcp(redisPort, 10_000);
    upApi = startApi(mongoUri, `redis://127.0.0.1:${redisPort}`, 5092);
    const upPort = await waitForReadyLine(upApi, 40_000);
    assertAlive(upApi, "redis-up api");
    const upReady = await request(upPort, "GET", "/ready");
    const upOtp = await request(upPort, "POST", "/api/v1/auth/customer/otp/send", {
      countryCode: "+91",
      phone: "9999999998",
      purpose: "login"
    });
    assertAlive(upApi, "redis-up api after requests");
    if (upReady.status !== 200 || upReady.json?.checks?.redis !== "ok") {
      throw new Error(`ready with redis was ${upReady.status} ${JSON.stringify(upReady.json?.checks || upReady.json)}`);
    }
    if (upOtp.status !== 200) throw new Error(`otp with redis was ${upOtp.status} ${upOtp.json?.error?.code || ""}`);
    console.log("STARTUP_UP ready=200 otp=200");
    await stopProcess(upApi);
    upApi = undefined;

    reconnect = spawn(process.execPath, ["scripts/check-redis-startup.mjs", "--reconnect"], {
      cwd: root,
      windowsHide: true,
      env: { ...process.env, NODE_ENV: "development" }
    });
    let reconnectOut = "";
    reconnect.stdout.on("data", (chunk) => { reconnectOut += chunk.toString(); });
    reconnect.stderr.on("data", (chunk) => { reconnectOut += chunk.toString(); });
    const waitForLine = async (line) => {
      const started = Date.now();
      while (Date.now() - started < 25_000) {
        if (reconnect.exitCode !== null && !reconnectOut.includes(line)) {
          throw new Error(`reconnect exited ${reconnect.exitCode} before ${line}\n${redact(reconnectOut)}`);
        }
        if (reconnectOut.includes(line)) return;
        await sleep(100);
      }
      throw new Error(`timed out waiting for ${line}\n${redact(reconnectOut)}`);
    };
    await waitForLine("REDIS_READY");
    await stopProcess(redisProcess);
    redisProcess = undefined;
    await waitForLine("REDIS_DOWN");
    redisProcess = startRedis(dir);
    await waitForTcp(redisPort, 10_000);
    await waitForLine("REDIS_BACK");
    const reconnectExit = await Promise.race([
      waitForExit(reconnect).then(() => reconnect.exitCode),
      sleep(10_000).then(() => "timeout")
    ]);
    if (reconnectExit !== 0) throw new Error(`reconnect exit ${reconnectExit}\n${redact(reconnectOut)}`);
    console.log("RECONNECT stopped redis, API client stayed up, ping succeeded after restart");
  } finally {
    await stopProcess(downApi);
    await stopProcess(upApi);
    await stopProcess(reconnect);
    await stopProcess(redisProcess);
    await mongo.stop();
    await fs.promises.rm(dir, { recursive: true, force: true });
  }
};

main().then(() => {
  console.log("STARTUP_CHECK pass");
  process.exit(0);
}).catch((error) => {
  console.error(redact(error.stack || error.message));
  process.exit(1);
});
