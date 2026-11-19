import mongoose from "mongoose";
import { ENTITY_TYPES } from "../../constants/enums.js";
import { applySchemaDefaults } from "../../database/schemaCommon.js";

export const collectionName = "editLocks";

export const schemaDefinition = {
  entityType: { type: String, enum: ENTITY_TYPES, required: true, index: true },
  entityId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
  adminName: String,
  /** When the lock was taken. The dashboard reads it; it used to fall back to createdAt. */
  lockedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
  releasedAt: Date
};

export const configureSchema = (schema) => {
  // One lock document per entity. (The previous partialFilterExpression `{ releasedAt: { $exists: false } }` is not
  // supported by MongoDB — `$exists:false` is rejected in partial indexes — so syncIndexes() failed on it.)
  // Released locks are reused by the acquire upsert and removed by the expiresAt TTL.
  schema.index({ entityType: 1, entityId: 1 }, { unique: true });

  applySchemaDefaults(schema);
};
