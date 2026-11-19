/**
 * M-12 / M-14 (partial): Backfill visits.visitAt and address cityKey/localityKey.
 * Does NOT build the slot unique index here — migrate.js syncIndexes runs after all data migrations.
 * Before enabling slot uniqueness in production, report and resolve double-booked slots manually.
 */
import { resolveVisitAt } from "../../src/modules/visits/visits.schema.js";
import { normalizeKey } from "../../src/database/schemaCommon.js";

export const up = async () => {
  const mongoose = (await import("mongoose")).default;
  const db = mongoose.connection.db;
  const summary = { visits: 0, properties: 0, sellRequests: 0, doubleBookedSlots: 0 };

  if (await db.listCollections({ name: "visits" }).hasNext()) {
    const visits = db.collection("visits");
    const cursor = visits.find({ $or: [{ visitAt: { $exists: false } }, { visitAt: null }] });
    while (await cursor.hasNext()) {
      const doc = await cursor.next();
      const visitAt = resolveVisitAt(doc.visitDate, doc.visitTime || "10:00 AM");
      const slotActive = ["scheduled", "confirmed", "rescheduled"].includes(doc.status);
      const $set = { slotActive };
      if (visitAt) $set.visitAt = visitAt;
      await visits.updateOne({ _id: doc._id }, { $set });
      summary.visits += 1;
    }

    const duplicates = await visits.aggregate([
      { $match: { slotActive: true, isDeleted: { $ne: true }, visitAt: { $type: "date" } } },
      { $group: { _id: { propertyId: "$propertyId", visitType: "$visitType", visitAt: "$visitAt" }, count: { $sum: 1 }, ids: { $push: "$_id" } } },
      { $match: { count: { $gt: 1 } } }
    ]).toArray();
    summary.doubleBookedSlots = duplicates.length;
    summary.doubleBookedSample = duplicates.slice(0, 20).map((row) => ({
      propertyId: row._id.propertyId,
      visitType: row._id.visitType,
      visitAt: row._id.visitAt,
      count: row.count,
      ids: row.ids
    }));
  }

  // Abort BEFORE migrate.js runs syncIndexes: the visit_slot_unique_active index must not be built on dirty data.
  // This migration is idempotent, so after resolving the duplicates it can simply be re-run.
  if (summary.doubleBookedSlots > 0) {
    throw new Error(
      `Migration 007 aborted: ${summary.doubleBookedSlots} double-booked visit slot group(s) found `
      + "(slotActive visits sharing propertyId + visitType + visitAt). The unique slot index cannot be built until "
      + "these are resolved. Resolve manually (cancel/reschedule the extra visits), then re-run `npm run migrate`. "
      + `Sample: ${JSON.stringify(summary.doubleBookedSample.slice(0, 5))}`
    );
  }

  const backfillKeys = async (collectionName) => {
    if (!(await db.listCollections({ name: collectionName }).hasNext())) return 0;
    const col = db.collection(collectionName);
    const cursor = col.find({
      $or: [
        { "address.city": { $type: "string" }, "address.cityKey": { $exists: false } },
        { "address.locality": { $type: "string" }, "address.localityKey": { $exists: false } }
      ]
    });
    let n = 0;
    while (await cursor.hasNext()) {
      const doc = await cursor.next();
      const $set = {};
      if (doc.address?.city && !doc.address.cityKey) $set["address.cityKey"] = normalizeKey(doc.address.city);
      if (doc.address?.locality && !doc.address.localityKey) $set["address.localityKey"] = normalizeKey(doc.address.locality);
      if (Object.keys($set).length) {
        await col.updateOne({ _id: doc._id }, { $set });
        n += 1;
      }
    }
    return n;
  };

  summary.properties = await backfillKeys("properties");
  summary.sellRequests = await backfillKeys("sellRequests");
  return summary;
};
