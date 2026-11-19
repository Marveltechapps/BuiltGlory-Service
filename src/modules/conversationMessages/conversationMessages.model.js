import mongoose from "mongoose";
import { schemaDefinition, configureSchema, collectionName } from "./conversationMessages.schema.js";
import { softDeletePlugin } from "../../database/softDelete.plugin.js";
const schema = new mongoose.Schema(schemaDefinition, { timestamps: true, collection: collectionName, toJSON: { virtuals: true }, toObject: { virtuals: true } });
schema.plugin(softDeletePlugin);
configureSchema?.(schema);
export const ConversationMessage = mongoose.models.ConversationMessage || mongoose.model("ConversationMessage", schema);
