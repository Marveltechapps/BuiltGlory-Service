/**
 * Stamp schemaVersion:1 on documents missing it (all business collections).
 */
const COLLECTIONS = [
  "users", "admins", "properties", "buyEnquiries", "visits", "chatThreads", "salesDeals", "payments",
  "interiorLeads", "sellRequests", "acquisitions", "supportTickets", "callbacks", "appFeedback",
  "documents", "notifications", "communicationLogs", "contentItems", "adminSettings",
  "conversationMessages", "boostOrders", "locations", "devices", "favorites", "propertyDailyStats",
  "propertyImportJobs", "searchHistory", "emailOtps", "editLocks", "auditLogs", "reportExports",
  "reportSchedules", "messageTemplates", "bulkMessages"
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
      { schemaVersion: { $exists: false } },
      { $set: { schemaVersion: 1 } }
    );
    summary[name] = { matched: result.matchedCount, modified: result.modifiedCount };
  }
  return summary;
};
