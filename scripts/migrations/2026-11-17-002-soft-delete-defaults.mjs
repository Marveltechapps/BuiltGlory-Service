/**
 * M-03: Write isDeleted:false on documents missing the field in soft-delete collections.
 */
const COLLECTIONS = [
  "users", "properties", "buyEnquiries", "visits", "chatThreads", "salesDeals", "payments",
  "interiorLeads", "sellRequests", "acquisitions", "supportTickets", "callbacks", "appFeedback",
  "documents", "notifications", "communicationLogs", "contentItems", "conversationMessages",
  "boostOrders", "locations"
];

export const up = async () => {
  const mongoose = (await import("mongoose")).default;
  const db = mongoose.connection.db;
  const summary = {};
  for (const name of COLLECTIONS) {
    const exists = await db.listCollections({ name }).hasNext();
    if (!exists) {
      summary[name] = { skipped: true };
      continue;
    }
    const result = await db.collection(name).updateMany(
      { isDeleted: { $exists: false } },
      { $set: { isDeleted: false, deletedAt: null, deletedBy: null, deletedByType: null } }
    );
    summary[name] = { matched: result.matchedCount, modified: result.modifiedCount };
  }
  return summary;
};
