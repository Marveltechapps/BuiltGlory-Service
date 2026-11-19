import mongoose from "mongoose";
import { env } from "../config/env.js";

const standaloneTransaction = (error) => {
  const message = String(error?.message || "");
  return error?.code === 20
    || error?.codeName === "IllegalOperation"
    || /Transaction numbers are only allowed|replica set member|not supported/i.test(message);
};

let transactionsAvailable;

export const supportsTransactions = async () => {
  if (transactionsAvailable !== undefined) return transactionsAvailable;
  try {
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    transactionsAvailable = Boolean(hello?.setName || hello?.msg === "isdbgrid");
  } catch {
    transactionsAvailable = false;
  }
  return transactionsAvailable;
};

/**
 * P0 (G-04): production must refuse to start when MongoDB cannot run multi-document transactions.
 * Local/dev/test may still use standalone MongoDB.
 */
export const assertTransactionsAvailableInProduction = async () => {
  if (env.NODE_ENV !== "production") return true;
  if (await supportsTransactions()) return true;
  throw new Error(
    "MongoDB transactions are unavailable. Production requires a replica set (or mongos). Refusing to start."
  );
};

/**
 * Runs `work` in a MongoDB transaction when the server is a replica set or mongos.
 * Standalone MongoDB (the local .env.example default) cannot use transactions, so the
 * same writes run without a session outside production.
 */
export const withTransaction = async (work) => {
  if (!(await supportsTransactions())) {
    if (env.NODE_ENV === "production") {
      throw new Error("MongoDB transactions are required in production.");
    }
    return work(undefined);
  }
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } catch (error) {
    if (!standaloneTransaction(error)) throw error;
    transactionsAvailable = false;
    if (env.NODE_ENV === "production") throw error;
    return work(undefined);
  } finally {
    await session.endSession();
  }
};
