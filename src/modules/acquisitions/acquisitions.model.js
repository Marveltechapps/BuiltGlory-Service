import mongoose from "mongoose";
import { schemaDefinition, configureSchema, collectionName } from "./acquisitions.schema.js";
import { softDeletePlugin } from "../../database/softDelete.plugin.js";
const schema = new mongoose.Schema(schemaDefinition, { timestamps: true, collection: collectionName, toJSON: { virtuals: true }, toObject: { virtuals: true } });
if (!["admins", "auditLogs"].includes(collectionName)) schema.plugin(softDeletePlugin);
configureSchema?.(schema);
schema.pre("save", function() { this.updatedAt = new Date(); });
export const Acquisition = mongoose.models.Acquisition || mongoose.model("Acquisition", schema);