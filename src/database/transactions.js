import mongoose from "mongoose";

const standaloneTransaction = (error) => {
  const message = String(error?.message || "");
  return error?.code === 20
    || error?.codeName === "IllegalOperation"
    || /Transaction numbers are only allowed|replica set member|not supported/i.test(message);
};

let transactionsAvailable;

const supportsTransactions = async () => {
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
 * Runs `work` in a MongoDB transaction when the server is a replica set or mongos.
 * Standalone MongoDB (the local .env.example default) cannot use transactions, so the
 * same writes run without a session. Production should use a replica set.
 */
export const withTransaction = async (work) => {
  if (!(await supportsTransactions())) return work(undefined);
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
    return work(undefined);
  } finally {
    await session.endSession();
  }
};
