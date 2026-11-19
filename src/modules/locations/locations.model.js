import mongoose from "mongoose";
import { schemaDefinition, configureSchema, collectionName } from "./locations.schema.js";
import { softDeletePlugin } from "../../database/softDelete.plugin.js";
const schema = new mongoose.Schema(schemaDefinition, { timestamps: true, collection: collectionName, toJSON: { virtuals: true }, toObject: { virtuals: true } });
schema.plugin(softDeletePlugin);
configureSchema?.(schema);
export const Location = mongoose.models.Location || mongoose.model("Location", schema);
