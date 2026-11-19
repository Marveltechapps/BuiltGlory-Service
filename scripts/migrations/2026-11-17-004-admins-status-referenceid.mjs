/**
 * M-13: Backfill admins.status from isActive, and assign referenceId when missing.
 */
import { makeReferenceId } from "../../src/utils/id.js";

export const up = async () => {
  const { Admin } = await import("../../src/modules/admins/admins.model.js");
  // passwordHash is never needed (or loaded) here.
  const docs = await Admin.find({}).select("status isActive referenceId").lean();
  let statusUpdated = 0;
  let referenceUpdated = 0;

  for (const doc of docs) {
    const $set = {};
    if (!doc.status) {
      $set.status = doc.isActive === false ? "suspended" : "active";
      statusUpdated += 1;
    }
    if (!doc.referenceId) {
      $set.referenceId = makeReferenceId("admins");
      referenceUpdated += 1;
    }
    if (Object.keys($set).length) {
      await Admin.collection.updateOne({ _id: doc._id }, { $set });
    }
  }

  return { scanned: docs.length, statusUpdated, referenceUpdated };
};
