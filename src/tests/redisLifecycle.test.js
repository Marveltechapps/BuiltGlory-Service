import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const runLifecycle = () => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, ["scripts/check-redis-lifecycle.mjs"], {
    cwd: root,
    env: { ...process.env, NODE_ENV: "development" },
    windowsHide: true
  });
  let stdout = "";
  let stderr = "";
  const timer = setTimeout(() => {
    child.kill();
    reject(new Error(`redis lifecycle script hung\nstdout: ${stdout}\nstderr: ${stderr}`));
  }, 20_000);
  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });
  child.on("error", (error) => {
    clearTimeout(timer);
    reject(error);
  });
  child.on("exit", (code) => {
    clearTimeout(timer);
    resolve({ code, stdout, stderr });
  });
});

describe("redis lifecycle", () => {
  test("a refused Redis port does not crash, and critical locks fail closed", async () => {
    const result = await runLifecycle();
    const line = result.stdout.split(/\r?\n/).find((entry) => entry.startsWith("REDIS_LIFECYCLE "));
    expect(result.code).toBe(0);
    expect(line).toBeTruthy();
    const body = JSON.parse(line.slice("REDIS_LIFECYCLE ".length));
    expect(body.pass).toBe(true);
    expect(body.target).toBe("redis://127.0.0.1:6399");
    expect(result.stderr).toMatch(/Redis is unavailable/);
    expect(result.stderr).not.toMatch(/rediss?:\/\/:[^@\s]+@/);
  }, 25_000);
});
