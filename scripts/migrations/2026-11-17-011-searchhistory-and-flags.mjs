/**
 * Small safe backfills:
 *  - searchHistory.lastSearchedAt  <- updatedAt, else createdAt (when missing)
 *  - searchHistory.searchCount     <- 1 (when missing)
 *  - buyEnquiries.duplicateOf      <- null (when the field is missing, so the partial unique index
 *                                     `open_enquiry_unique_buyer_property` covers these rows)
 *  - bulkMessages.counts.queued    <- queuedCount (legacy counter) when counts.queued is missing/0
 *
 * Idempotent: every update only matches documents where the target is still missing.
 */
export const up = async () => {
  const mongoose = (await import("mongoose")).default;
  const db = mongoose.connection.db;
  const has = async (name) => db.listCollections({ name }).hasNext();
  const summary = {};

  if (await has("searchHistory")) {
    const col = db.collection("searchHistory");
    const lastSearched = await col.updateMany(
      {
        $or: [{ lastSearchedAt: { $exists: false } }, { lastSearchedAt: null }],
        $and: [{ $or: [{ updatedAt: { $type: "date" } }, { createdAt: { $type: "date" } }] }]
      },
      [{ $set: { lastSearchedAt: { $ifNull: ["$updatedAt", "$createdAt"] } } }]
    );
    const count = await col.updateMany(
      { $or: [{ searchCount: { $exists: false } }, { searchCount: null }] },
      { $set: { searchCount: 1 } }
    );
    summary.searchHistory = { lastSearchedAt: lastSearched.modifiedCount, searchCount: count.modifiedCount };
  }

  if (await has("buyEnquiries")) {
    const res = await db.collection("buyEnquiries").updateMany(
      { duplicateOf: { $exists: false } },
      { $set: { duplicateOf: null } }
    );
    summary.buyEnquiries = { duplicateOf: res.modifiedCount };
  }

  if (await has("bulkMessages")) {
    const res = await db.collection("bulkMessages").updateMany(
      {
        queuedCount: { $type: "number", $gt: 0 },
        $or: [{ "counts.queued": { $exists: false } }, { "counts.queued": null }, { "counts.queued": 0 }]
      },
      [{ $set: { "counts.queued": "$queuedCount" } }]
    );
    summary.bulkMessages = { countsQueued: res.modifiedCount };
  }

  return summary;
};
