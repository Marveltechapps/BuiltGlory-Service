import { createHash } from "node:crypto";
import mongoose from "mongoose";
import { DEVICE_PLATFORMS } from "../../constants/enums.js";
import { applySchemaDefaults } from "../../database/schemaCommon.js";

/**
 * devices (DATABASE_ARCHITECTURE.md §5.3)
 * One document per push-token install. A token has exactly one owner at a time:
 * PUT /me/push-token upserts by tokenHash and moves the token to the current user.
 * No soft delete (TTL-cleaned) and no referenceId (never shown as a standalone record).
 */
export const deviceCollectionName = "devices";

export const deviceSchemaDefinition = {
  token: { type: String, required: true, minlength: 20, maxlength: 4096, trim: true },
  tokenHash: { type: String, required: true, trim: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  platform: { type: String, enum: DEVICE_PLATFORMS, required: true, default: "android" },
  deviceId: { type: String, maxlength: 200, trim: true },
  appVersion: { type: String, maxlength: 50, trim: true },
  lastSeenAt: { type: Date, required: true, default: Date.now },
  invalidatedAt: { type: Date },
  invalidReason: { type: String, maxlength: 500 }
};

const schema = new mongoose.Schema(deviceSchemaDefinition, {
  timestamps: true,
  collection: deviceCollectionName,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Upsert and invalidation. Tokens can exceed a comfortable index key size, so uniqueness is on the hash.
schema.index({ tokenHash: 1 }, { unique: true });
// Push fan-out to a user's live devices.
schema.index({ userId: 1, invalidatedAt: 1, lastSeenAt: -1 });
// Stale-token cleanup: 180 days after last seen.
schema.index({ lastSeenAt: 1 }, { expireAfterSeconds: 15552000 });

// Callers that only know the raw token (tests, scripts) still get a valid tokenHash.
schema.pre("validate", function deriveTokenHash() {
  if (this.token && !this.tokenHash) {
    this.tokenHash = createHash("sha256").update(this.token).digest("hex");
  }
});

applySchemaDefaults(schema);

export const Device = mongoose.models.Device || mongoose.model("Device", schema);
