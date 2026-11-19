/**
 * M-02: One-off rewrite of existing auditLogs before/after to redact sensitive paths (G-02).
 * Uses the raw collection (bypasses Mongoose immutability hooks). Run only via bg_migrator.
 */
import { AUDIT_REDACT_PATHS, buildAuditDiff } from "../../src/services/audit.service.js";

export const up = async () => {
  const mongoose = (await import("mongoose")).default;
  const collection = mongoose.connection.db.collection("auditLogs");
  const cursor = collection.find({});
  let scanned = 0;
  let rewritten = 0;

  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    scanned += 1;
    if (doc.before == null && doc.after == null) continue;

    const diff = buildAuditDiff(doc.before, doc.after);
    const needsRewrite = JSON.stringify(doc.before) !== JSON.stringify(diff.before)
      || JSON.stringify(doc.after) !== JSON.stringify(diff.after)
      || (Array.isArray(doc.changedFields) === false && diff.changedFields.length);

    if (!needsRewrite) continue;

    await collection.updateOne(
      { _id: doc._id },
      {
        $set: {
          before: diff.before,
          after: diff.after,
          changedFields: diff.changedFields,
          schemaVersion: 1
        }
      }
    );
    rewritten += 1;
  }

  return { scanned, rewritten, redactedPaths: AUDIT_REDACT_PATHS };
};
