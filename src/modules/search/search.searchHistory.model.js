import mongoose from "mongoose";
import { SEARCH_HISTORY_SOURCES } from "../../constants/enums.js";
import { applySchemaDefaults } from "../../database/schemaCommon.js";

const searchHistorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  term: { type: String, required: true, trim: true, maxlength: 100 },
  normalizedTerm: { type: String, required: true, trim: true, lowercase: true, maxlength: 100, index: true },
  resultCount: { type: Number, default: 0, min: 0 },
  /** Sort key for "recent searches" (instead of updatedAt). */
  lastSearchedAt: { type: Date, default: Date.now },
  /** Weight for trending terms. */
  searchCount: { type: Number, default: 1, min: 1 },
  source: { type: String, enum: SEARCH_HISTORY_SOURCES, default: "customer_app" }
}, { timestamps: true, collection: "searchHistory" });

searchHistorySchema.index({ userId: 1, updatedAt: -1 }); // legacy sort key
searchHistorySchema.index({ normalizedTerm: 1, updatedAt: -1 }); // legacy trending key
searchHistorySchema.index({ userId: 1, lastSearchedAt: -1 }); // [N] recent searches
searchHistorySchema.index({ normalizedTerm: 1, lastSearchedAt: -1 }); // [N] trending
// [N] One row per user per term: makes the service's upsert-by-term race-free.
searchHistorySchema.index({ userId: 1, normalizedTerm: 1 }, { unique: true });
// The architecture also calls for a TTL on lastSearchedAt (180 days). Deferred: the current service updates rows
// without refreshing lastSearchedAt, so a TTL would delete terms users searched recently.

applySchemaDefaults(searchHistorySchema);

export const SearchHistory = mongoose.models.SearchHistory || mongoose.model("SearchHistory", searchHistorySchema);
