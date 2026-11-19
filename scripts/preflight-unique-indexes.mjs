/**
 * Preflight for the unique / partial-unique indexes that `syncIndexes()` will build.
 *
 * READ-ONLY: runs aggregations only. Reports, per index, how many duplicate key groups exist so they can be
 * resolved manually BEFORE migrate.js builds the index (a unique index build fails on dirty data).
 *
 * Usage:   node scripts/preflight-unique-indexes.mjs      (uses MONGODB_URI)
 * Reuse:   import { runPreflight } from "./preflight-unique-indexes.mjs"; await runPreflight(mongoose.connection.db)
 * Exit:    1 when any duplicates are found, 0 when clean.
 *
 * Match filters mirror each index's partialFilterExpression. Fields that are backfilled by earlier migrations
 * (isOpen, slotActive, reservesProperty, duplicateOf) are matched leniently where noted, so running this in
 * --dry-run (before migrations are applied) is conservative rather than blind.
 */
import path from "node:path";
import { pathToFileURL } from "node:url";

const SAMPLE_SIZE = 5;

export const PREFLIGHT_CHECKS = [
  {
    name: "visits: active slot (propertyId + visitType + visitAt)",
    collection: "visits",
    index: "visit_slot_unique_active",
    match: { slotActive: true, isDeleted: false, visitAt: { $type: "date" } },
    key: { propertyId: "$propertyId", visitType: "$visitType", visitAt: "$visitAt" }
  },
  {
    name: "buyEnquiries: open buyer + property",
    collection: "buyEnquiries",
    index: "open_enquiry_unique_buyer_property",
    // `duplicateOf: null` also matches rows where the field is missing (migration 011 sets it to null).
    match: { isOpen: true, isDeleted: false, duplicateOf: null },
    key: { propertyId: "$propertyId", buyerId: "$buyerId" }
  },
  {
    name: "salesDeals: open sourceEnquiryId",
    collection: "salesDeals",
    index: "sourceEnquiryId_1 (partial unique)",
    match: { isOpen: true, isDeleted: false, sourceEnquiryId: { $type: "objectId" } },
    key: { sourceEnquiryId: "$sourceEnquiryId" }
  },
  {
    name: "salesDeals: reservesProperty per propertyId",
    collection: "salesDeals",
    index: "deal_reserves_property_unique",
    match: { reservesProperty: true, isDeleted: false },
    key: { propertyId: "$propertyId" }
  },
  {
    name: "payments: open inbound deal + type + milestone + user",
    collection: "payments",
    index: "open_payment_unique_deal_type_milestone",
    match: { isOpen: true, direction: "inbound", dealId: { $type: "objectId" } },
    key: { dealId: "$dealId", type: "$type", milestoneId: "$milestoneId", userId: "$userId" }
  },
  {
    name: "payments: idempotencyKey (global sparse unique, [D])",
    collection: "payments",
    index: "idempotencyKey_1",
    match: { idempotencyKey: { $type: "string" } },
    key: { idempotencyKey: "$idempotencyKey" }
  },
  {
    name: "payments: userId + idempotencyKey",
    collection: "payments",
    index: "userId_1_idempotencyKey_1",
    match: { idempotencyKey: { $type: "string" } },
    key: { userId: "$userId", idempotencyKey: "$idempotencyKey" }
  },
  {
    name: "supportTickets: open live_chat per user",
    collection: "supportTickets",
    index: "open_live_chat_unique_user",
    match: { isOpen: true, channel: "live_chat", isDeleted: false },
    key: { userId: "$userId" }
  },
  {
    name: "searchHistory: userId + normalizedTerm",
    collection: "searchHistory",
    index: "userId_1_normalizedTerm_1",
    match: {},
    key: { userId: "$userId", normalizedTerm: "$normalizedTerm" }
  },
  {
    name: "messageTemplates: channel + name",
    collection: "messageTemplates",
    index: "channel_1_name_1",
    match: {},
    key: { channel: "$channel", name: "$name" }
  },
  {
    name: "admins: referenceId (non-null)",
    collection: "admins",
    index: "referenceId_1 (partial unique)",
    match: { referenceId: { $type: "string" } },
    key: { referenceId: "$referenceId" }
  }
];

const runCheck = async (db, check) => {
  const base = { name: check.name, collection: check.collection, index: check.index };
  if (!(await db.listCollections({ name: check.collection }).hasNext())) {
    return { ...base, skipped: true, duplicateGroups: 0, duplicateDocs: 0, sample: [] };
  }
  const pipeline = [
    { $match: check.match },
    { $group: { _id: check.key, count: { $sum: 1 }, ids: { $push: "$_id" } } },
    { $match: { count: { $gt: 1 } } },
    { $facet: {
      summary: [{ $group: { _id: null, groups: { $sum: 1 }, docs: { $sum: "$count" } } }],
      sample: [{ $limit: SAMPLE_SIZE }, { $project: { _id: 1, count: 1, ids: { $slice: ["$ids", 10] } } }]
    } }
  ];
  const [out] = await db.collection(check.collection).aggregate(pipeline, { allowDiskUse: true }).toArray();
  const summary = out?.summary?.[0];
  return {
    ...base,
    duplicateGroups: summary?.groups || 0,
    duplicateDocs: summary?.docs || 0,
    sample: out?.sample || []
  };
};

/**
 * @param {import("mongodb").Db} db
 * @param {{ log?: boolean }} [options]
 * @returns {Promise<{ ok: boolean, totalDuplicateGroups: number, results: object[] }>}
 */
export const runPreflight = async (db, { log = true } = {}) => {
  const results = [];
  for (const check of PREFLIGHT_CHECKS) {
    const result = await runCheck(db, check);
    results.push(result);
    if (!log) continue;
    if (result.skipped) console.log(`skip   ${check.name} (collection "${check.collection}" missing)`);
    else if (result.duplicateGroups === 0) console.log(`clean  ${check.name}`);
    else {
      console.error(`DUPES  ${check.name}: ${result.duplicateGroups} group(s), ${result.duplicateDocs} doc(s) [index ${check.index}]`);
      console.error(`       sample: ${JSON.stringify(result.sample)}`);
    }
  }
  const totalDuplicateGroups = results.reduce((sum, row) => sum + row.duplicateGroups, 0);
  return { ok: totalDuplicateGroups === 0, totalDuplicateGroups, results };
};

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMain) {
  const { default: mongoose } = await import("mongoose");
  const { connectDatabase, disconnectDatabase } = await import("../src/database/connection.js");
  let exitCode = 0;
  try {
    await connectDatabase();
    const { ok, totalDuplicateGroups } = await runPreflight(mongoose.connection.db);
    if (ok) console.log("Preflight clean: safe to build unique indexes.");
    else {
      console.error(`Preflight FAILED: ${totalDuplicateGroups} duplicate group(s). Resolve manually, then re-run.`);
      exitCode = 1;
    }
  } catch (error) {
    console.error("Preflight error:", error?.message || error);
    exitCode = 1;
  } finally {
    await disconnectDatabase();
  }
  process.exit(exitCode);
}
