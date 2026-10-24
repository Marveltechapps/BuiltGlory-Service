import mongoose from "mongoose";
import { schemaDefinition, configureSchema, collectionName } from "./content.schema.js";
import { softDeletePlugin } from "../../database/softDelete.plugin.js";

const schema = new mongoose.Schema(schemaDefinition, { timestamps: true, collection: collectionName, toJSON: { virtuals: true }, toObject: { virtuals: true } });
schema.plugin(softDeletePlugin);
configureSchema?.(schema);
schema.pre("save", function() { this.updatedAt = new Date(); });

export const ContentItem = mongoose.models.ContentItem || mongoose.model("ContentItem", schema);
