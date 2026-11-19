/**
 * Backfill stageEnteredAt on salesDeals and acquisitions where it is missing.
 *
 * Source of truth is the LAST stageHistory entry (enteredAt, else changedAt). When a document has no usable
 * history, createdAt is used (the document entered its initial stage when it was created). We never use "now":
 * a fake timestamp would make every legacy deal look like it just changed stage.
 *
 * Idempotent: only documents with a missing/null stageEnteredAt are touched.
 */
const BATCH = 500;

const missing = { $or: [{ stageEnteredAt: { $exists: false } }, { stageEnteredAt: null }] };

const asDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const lastHistoryDate = (history) => {
  if (!Array.isArray(history)) return null;
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const date = asDate(history[i]?.enteredAt) || asDate(history[i]?.changedAt);
    if (date) return date;
  }
  return null;
};

const backfillCollection = async (db, name) => {
  const stats = { scanned: 0, fromHistory: 0, fromCreatedAt: 0, unresolved: 0 };
  if (!(await db.listCollections({ name }).hasNext())) return { ...stats, skipped: "collection missing" };
  const col = db.collection(name);
  let lastId = null;

  for (;;) {
    const filter = lastId ? { $and: [missing, { _id: { $gt: lastId } }] } : missing;
    const docs = await col.find(filter, { projection: { stageHistory: 1, createdAt: 1 } }).sort({ _id: 1 }).limit(BATCH).toArray();
    if (!docs.length) break;
    lastId = docs[docs.length - 1]._id;
    stats.scanned += docs.length;

    const ops = [];
    for (const doc of docs) {
      const fromHistory = lastHistoryDate(doc.stageHistory);
      const value = fromHistory || asDate(doc.createdAt);
      if (!value) {
        stats.unresolved += 1;
        continue;
      }
      if (fromHistory) stats.fromHistory += 1;
      else stats.fromCreatedAt += 1;
      ops.push({ updateOne: { filter: { _id: doc._id, ...missing }, update: { $set: { stageEnteredAt: value } } } });
    }
    if (ops.length) await col.bulkWrite(ops, { ordered: false });
  }
  return stats;
};

export const up = async () => {
  const mongoose = (await import("mongoose")).default;
  const db = mongoose.connection.db;
  return {
    salesDeals: await backfillCollection(db, "salesDeals"),
    acquisitions: await backfillCollection(db, "acquisitions")
  };
};
