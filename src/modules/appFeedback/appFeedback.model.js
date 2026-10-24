import mongoose from "mongoose";
import { schemaDefinition, configureSchema, collectionName } from "./appFeedback.schema.js";
import { softDeletePlugin } from "../../database/softDelete.plugin.js";

const schema = new mongoose.Schema(schemaDefinition, {
  timestamps: true,
  collection: collectionName,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

schema.plugin(softDeletePlugin);
configureSchema?.(schema);

export const AppFeedback = mongoose.models.AppFeedback || mongoose.model("AppFeedback", schema);
