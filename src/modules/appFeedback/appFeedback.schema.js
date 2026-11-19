import mongoose from "mongoose";
import { FEEDBACK_SOURCES } from "../../constants/enums.js";
import { applySchemaDefaults } from "../../database/schemaCommon.js";

const { ObjectId, Mixed } = mongoose.Schema.Types;

export const collectionName = "appFeedback";

export const schemaDefinition = {
  referenceId: { type: String, required: true, unique: true, index: true },
  userId: { type: ObjectId, ref: "User", required: true, index: true },
  /** Dashboard reads userName from here. */
  userSnapshot: { name: String },
  message: { type: String, required: true, maxlength: 5000 },
  source: { type: String, enum: FEEDBACK_SOURCES, default: "customer_app" },
  sourceScreen: { type: String, default: "help" },
  /** Optional star rating (P3). */
  rating: { type: Number, min: 1, max: 5 },
  /** Promoted out of metadata. */
  appVersion: String,
  platform: String,
  // `status` is also covered by the { status: 1, createdAt: -1 } compound index in configureSchema; the standalone
  // { status: 1 } index is retained there until the post-deploy monitor ([D]).
  status: { type: String, enum: ["new", "reviewed", "archived"], default: "new" },
  reviewedBy: { type: ObjectId, ref: "Admin" },
  reviewedAt: Date,
  metadata: { type: Mixed, default: {} }
};

export const configureSchema = (schema) => {
  schema.index({ createdAt: -1 });
  schema.index({ status: 1, createdAt: -1 });
  schema.index({ status: 1 }); // [D] retain until 7-day post-deploy monitor; then drop

  applySchemaDefaults(schema);
};
