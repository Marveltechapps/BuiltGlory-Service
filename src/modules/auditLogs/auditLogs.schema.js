import mongoose from "mongoose";
import { ACTOR_TYPES } from "../../constants/enums.js";
import { applySchemaDefaults } from "../../database/schemaCommon.js";

const { ObjectId, Mixed } = mongoose.Schema.Types;

export const collectionName = "auditLogs";

export const schemaDefinition = {
  actorType: { type: String, enum: ACTOR_TYPES, required: true },
  actorId: ObjectId,
  /** Snapshot: survives admin rename or user anonymisation. */
  actorName: String,
  /** Intended pattern: "<resource>.<verb>" (e.g. salesDeals.stage_changed). Not enforced: legacy actions differ. */
  action: { type: String, required: true },
  /** P1: dashboard reads it. */
  description: String,
  // Free string for now: legacy rows mix collection names and singular names ("admin", "sellRequests", "content").
  resourceType: { type: String, required: true },
  resourceId: ObjectId,
  /** Searchable human-readable id, e.g. BG-DEAL-2026-K3Z9QA. */
  resourceReferenceId: String,
  changedFields: [String],
  // Opaque payloads. Target is a redacted diff (changed paths only, sensitive paths replaced by "[redacted]").
  before: Mixed,
  after: Mixed,
  /** Joins to request logs. */
  requestId: String,
  ipAddress: String,
  userAgent: String
};

const IMMUTABLE_MESSAGE = "Audit logs are immutable.";

export const configureSchema = (schema) => {
  schema.index({ resourceType: 1, resourceId: 1, createdAt: -1 });
  schema.index({ actorId: 1, createdAt: -1 });
  schema.index({ action: 1, createdAt: -1 });
  schema.index({ createdAt: -1 }); // [N] default Audit Trail view
  schema.index({ resourceReferenceId: 1 }, { sparse: true }); // [N]

  // Immutability. Throwing synchronously rejects the operation without relying on a `next` callback.
  const blockMutation = function blockMutation() {
    throw new Error(IMMUTABLE_MESSAGE);
  };
  for (const op of ["findOneAndUpdate", "findOneAndReplace", "findOneAndDelete", "updateOne", "updateMany", "replaceOne", "deleteOne", "deleteMany"]) {
    schema.pre(op, blockMutation);
  }
  // Document-level mutations (doc.updateOne(), doc.deleteOne(), doc.save() on an existing document).
  schema.pre("updateOne", { document: true, query: false }, blockMutation);
  schema.pre("deleteOne", { document: true, query: false }, blockMutation);
  schema.pre("save", function blockResave() {
    if (!this.isNew) throw new Error(IMMUTABLE_MESSAGE);
  });
  // Model.bulkWrite: only inserts are allowed. The ops array is the first non-callback argument.
  schema.pre("bulkWrite", function blockBulkMutations(...args) {
    const ops = args.find(Array.isArray) || [];
    const mutating = ops.some((operation) => {
      const kind = Object.keys(operation || {})[0];
      return kind && kind !== "insertOne";
    });
    if (mutating) throw new Error(IMMUTABLE_MESSAGE);
  });

  applySchemaDefaults(schema);
};
