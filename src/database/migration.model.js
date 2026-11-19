import mongoose from "mongoose";
import { applySchemaDefaults } from "./schemaCommon.js";

/**
 * migrations (DATABASE_ARCHITECTURE.md §12.8)
 * One document per versioned data migration. `_id` is the migration id,
 * e.g. `2026-12-01-001-users-remove-plaintext-otp`. No soft delete.
 */
export const MIGRATION_STATUSES = ["running", "applied", "failed"];

export const migrationCollectionName = "migrations";

export const migrationSchemaDefinition = {
  _id: { type: String, required: true, trim: true },
  appliedAt: { type: Date },
  durationMs: { type: Number, min: 0 },
  checksum: { type: String, trim: true },
  status: { type: String, enum: MIGRATION_STATUSES, default: "running", required: true },
  error: { type: String },
  /** Summary returned by the migration's `up()` (counts, samples). */
  result: mongoose.Schema.Types.Mixed
};

const schema = new mongoose.Schema(migrationSchemaDefinition, {
  timestamps: true,
  collection: migrationCollectionName,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

applySchemaDefaults(schema);

export const Migration = mongoose.models.Migration || mongoose.model("Migration", schema);
