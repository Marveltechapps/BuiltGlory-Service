/**
 * Versioned migration runner (DATABASE_ARCHITECTURE §12.8 / §15).
 *
 * Order:
 *  1. Connect (and best-effort Redis lock `job:lock:migrations`)
 *  2. Run pending data migrations under scripts/migrations/ (idempotent, tracked in `migrations`)
 *  3. Preflight: report duplicates that would make unique indexes fail (scripts/preflight-unique-indexes.mjs)
 *  4. syncIndexes() for ALL models LAST so unique indexes do not fail on unclean data
 *
 * WARNING: syncIndexes() DROPS every index that is not declared on the Mongoose schemas (and creates missing
 * ones). Anything created by hand in the database that is not in the schema files will be removed.
 *
 * Usage:
 *   npm run migrate                      apply pending migrations, preflight, syncIndexes
 *   npm run migrate -- --dry-run         list pending migrations + run preflight. NO writes, no lock, no syncIndexes
 *   npm run migrate -- --skip-preflight  skip the duplicate-key preflight (not recommended)
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { connectDatabase, disconnectDatabase } from "../src/database/connection.js";
import { Migration } from "../src/database/migration.model.js";
import { syncAllIndexes } from "../src/database/models.js";
import { getRedis, closeRedis } from "../src/config/redis.js";
import { runPreflight } from "./preflight-unique-indexes.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, "migrations");

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has("--dry-run");
const SKIP_PREFLIGHT = args.has("--skip-preflight");

const LOCK_KEY = "job:lock:migrations";
const LOCK_TTL_SECONDS = 60 * 60;
const REDIS_TIMEOUT_MS = 5000;

const checksumOf = (source) => crypto.createHash("sha256").update(source).digest("hex");

const listMigrationFiles = () => {
  if (!fs.existsSync(migrationsDir)) return [];
  return fs.readdirSync(migrationsDir)
    .filter((name) => /^\d{4}-\d{2}-\d{2}-\d{3}-.+\.mjs$/.test(name))
    .sort();
};

const withTimeout = (promise, ms, label) => Promise.race([
  promise,
  new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms))
]);

/** Best-effort distributed lock. Returns true when held, false when unavailable (never throws for "Redis down"). */
const acquireMigrationLock = async () => {
  try {
    const redis = getRedis();
    const existing = await withTimeout(redis.get(LOCK_KEY), REDIS_TIMEOUT_MS, "Redis GET");
    if (existing) throw Object.assign(new Error(`Another migration run holds ${LOCK_KEY} (since ${existing}).`), { locked: true });
    const res = await withTimeout(redis.set(LOCK_KEY, String(Date.now()), "EX", LOCK_TTL_SECONDS, "NX"), REDIS_TIMEOUT_MS, "Redis SET");
    if (res === null) throw Object.assign(new Error(`Another migration run holds ${LOCK_KEY}.`), { locked: true });
    console.log(`lock  acquired ${LOCK_KEY}`);
    return true;
  } catch (error) {
    if (error?.locked) throw error;
    console.warn(`lock  Redis unavailable (${error?.message || error}); continuing WITHOUT ${LOCK_KEY}`);
    return false;
  }
};

const releaseMigrationLock = async () => {
  try {
    await withTimeout(getRedis().del(LOCK_KEY), REDIS_TIMEOUT_MS, "Redis DEL");
    console.log(`lock  released ${LOCK_KEY}`);
  } catch (error) {
    console.warn(`lock  could not release ${LOCK_KEY}: ${error?.message || error}`);
  }
};

const toPlainResult = (result) => {
  if (result === undefined) return null;
  try {
    return JSON.parse(JSON.stringify(result));
  } catch {
    return { note: "result not serialisable" };
  }
};

const runMigrationFile = async (fileName) => {
  const id = fileName.replace(/\.mjs$/, "");
  const fullPath = path.join(migrationsDir, fileName);
  const source = fs.readFileSync(fullPath, "utf8");
  const checksum = checksumOf(source);

  const existing = await Migration.findById(id).lean();
  if (existing?.status === "applied") {
    if (existing.checksum && existing.checksum !== checksum) {
      throw new Error(`Migration ${id} was already applied but its script checksum changed.`);
    }
    console.log(`skip  ${id} (already applied)`);
    return;
  }

  const started = Date.now();
  await Migration.findByIdAndUpdate(
    id,
    { _id: id, status: "running", checksum, error: null, appliedAt: null, durationMs: null },
    { upsert: true, new: true }
  );

  try {
    const mod = await import(`file://${fullPath}`);
    if (typeof mod.up !== "function") throw new Error(`Migration ${id} must export async function up(ctx)`);
    const result = await mod.up({ Migration });
    await Migration.findByIdAndUpdate(id, {
      status: "applied",
      appliedAt: new Date(),
      durationMs: Date.now() - started,
      checksum,
      error: null,
      result: toPlainResult(result)
    });
    console.log(`ok    ${id}`, result || "");
  } catch (error) {
    await Migration.findByIdAndUpdate(id, {
      status: "failed",
      durationMs: Date.now() - started,
      checksum,
      error: String(error?.stack || error?.message || error)
    });
    throw error;
  }
};

const listPending = async () => {
  const pending = [];
  for (const file of listMigrationFiles()) {
    const id = file.replace(/\.mjs$/, "");
    const checksum = checksumOf(fs.readFileSync(path.join(migrationsDir, file), "utf8"));
    const existing = await Migration.findById(id).lean();
    if (existing?.status === "applied") {
      if (existing.checksum && existing.checksum !== checksum) {
        console.warn(`warn  ${id} already applied but its script checksum changed (a real run would abort)`);
      }
      continue;
    }
    pending.push({ id, previousStatus: existing?.status || "never run" });
  }
  return pending;
};

const doPreflight = async () => {
  if (SKIP_PREFLIGHT) {
    console.warn("preflight SKIPPED (--skip-preflight). Unique index builds may fail on duplicate data.");
    return true;
  }
  console.log("Running unique-index preflight...");
  const { ok, totalDuplicateGroups } = await runPreflight(mongoose.connection.db);
  if (!ok) console.error(`Preflight FAILED: ${totalDuplicateGroups} duplicate group(s). Resolve manually, then re-run.`);
  return ok;
};

const main = async () => {
  await connectDatabase();

  if (DRY_RUN) {
    console.log("DRY RUN: no writes, no lock, no syncIndexes.");
    const pending = await listPending();
    if (!pending.length) console.log("No pending migrations.");
    for (const row of pending) console.log(`pending ${row.id} (${row.previousStatus})`);
    console.log("Note: preflight below reflects CURRENT data; pending migrations may change it.");
    const ok = await doPreflight();
    console.log(ok ? "Dry run complete: preflight clean." : "Dry run complete: preflight found duplicates.");
    if (!ok) process.exitCode = 1;
    return;
  }

  const lockHeld = await acquireMigrationLock();
  try {
    console.log("Running data migrations...");
    for (const file of listMigrationFiles()) {
      await runMigrationFile(file);
    }

    if (!(await doPreflight())) {
      process.exitCode = 1;
      console.error("Aborting BEFORE syncIndexes. No indexes were changed.");
      return;
    }

    console.warn("WARNING: syncIndexes WILL DROP every index that is not declared in the Mongoose schemas.");
    console.log("Synchronizing indexes for all models...");
    const indexResults = await syncAllIndexes();
    const failed = indexResults.filter((row) => row.status === "error");
    for (const row of indexResults) {
      if (row.status === "ok") console.log(`index ${row.model}`);
      else console.error(`index ${row.model} FAILED: ${row.error}`);
    }
    if (failed.length) {
      throw new Error(`${failed.length} model(s) failed syncIndexes`);
    }
    console.log("Migration complete");
  } finally {
    if (lockHeld) await releaseMigrationLock();
  }
};

try {
  await main();
} finally {
  await closeRedis().catch(() => {});
  await disconnectDatabase();
}
