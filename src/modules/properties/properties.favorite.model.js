import mongoose from "mongoose";
import { applySchemaDefaults, moneyField } from "../../database/schemaCommon.js";

/**
 * favorites (DATABASE_ARCHITECTURE.md §6.2)
 * Replaces properties.savedByUsers[]. Hard delete on unsave; no soft delete, no referenceId.
 */
export const favoriteCollectionName = "favorites";

export const favoriteSchemaDefinition = {
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  propertyId: { type: mongoose.Schema.Types.ObjectId, ref: "Property", required: true },
  priceAtSave: moneyField({ required: true }),
  notifyOnPriceDrop: { type: Boolean, required: true, default: true }
};

const schema = new mongoose.Schema(favoriteSchemaDefinition, {
  timestamps: { createdAt: true, updatedAt: false },
  collection: favoriteCollectionName,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Idempotent save/unsave (ignore 11000 on insert).
schema.index({ userId: 1, propertyId: 1 }, { unique: true });
// GET /me/favorites, newest first.
schema.index({ userId: 1, createdAt: -1 });
// Price-drop fan-out; savedCount reconciliation.
schema.index({ propertyId: 1 });

applySchemaDefaults(schema);

export const Favorite = mongoose.models.Favorite || mongoose.model("Favorite", schema);
