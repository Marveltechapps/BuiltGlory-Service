import mongoose from "mongoose";
import { applySchemaDefaults } from "../../database/schemaCommon.js";

/**
 * propertyDailyStats (DATABASE_ARCHITECTURE.md §6.3)
 * Per-property per-day counters written with `$inc` + `upsert: true`.
 * `date` is 00:00 IST of the day. No soft delete; TTL removes rows after 400 days.
 */
export const dailyStatCollectionName = "propertyDailyStats";

const counter = () => ({ type: Number, default: 0, min: 0 });

export const dailyStatSchemaDefinition = {
  propertyId: { type: mongoose.Schema.Types.ObjectId, ref: "Property", required: true },
  date: { type: Date, required: true },
  views: counter(),
  uniqueViewers: counter(),
  enquiries: counter(),
  visits: counter(),
  saves: counter(),
  shares: counter(),
  compares: counter()
};

const schema = new mongoose.Schema(dailyStatSchemaDefinition, {
  timestamps: true,
  collection: dailyStatCollectionName,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

schema.index({ propertyId: 1, date: -1 }, { unique: true });
// 400 days.
schema.index({ date: 1 }, { expireAfterSeconds: 34560000 });

applySchemaDefaults(schema);

export const PropertyDailyStat = mongoose.models.PropertyDailyStat || mongoose.model("PropertyDailyStat", schema);
