import mongoose from "mongoose";
import { schemaDefinition, configureSchema, collectionName } from "./boostOrders.schema.js";
import { softDeletePlugin } from "../../database/softDelete.plugin.js";
const schema = new mongoose.Schema(schemaDefinition, { timestamps: true, collection: collectionName, toJSON: { virtuals: true }, toObject: { virtuals: true } });
schema.plugin(softDeletePlugin);
configureSchema?.(schema);
export const BoostOrder = mongoose.models.BoostOrder || mongoose.model("BoostOrder", schema);
