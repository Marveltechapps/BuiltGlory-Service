import mongoose from "mongoose";
import { ENTITY_TYPES, COMM_LOG_CHANNELS, ACTOR_TYPES } from "../../constants/enums.js";
import { applySchemaDefaults, arrayMax } from "../../database/schemaCommon.js";

const { ObjectId } = mongoose.Schema.Types;

export const collectionName = "communicationLogs";

const attachmentSchema = new mongoose.Schema({
  /** Target reference: files live in `documents`. */
  documentId: { type: ObjectId, ref: "Document" },
  fileName: String,
  mimeType: String,
  sizeBytes: Number,
  /** @deprecated use documentId. */
  url: String,
  /** @deprecated use documentId. */
  storageKey: String
});

export const schemaDefinition = {
  referenceId: { type: String, required: true, unique: true, index: true },
  // Single-field indexes on entityType / entityId are covered by the compound index in configureSchema ([D]); they
  // stay declared there until the post-deploy monitor window ends.
  entityType: { type: String, enum: ENTITY_TYPES, required: true },
  entityId: { type: ObjectId, required: true },
  // "message" rows are deprecated (seller messages move to conversationMessages) but remain valid for dual-read.
  channel: { type: String, enum: COMM_LOG_CHANNELS, required: true },
  direction: { type: String, enum: ["inbound", "outbound", "internal"], default: "internal" },
  summary: { type: String, required: true, maxlength: 500 },
  body: { type: String, maxlength: 10000 },
  outcome: String,
  durationMinutes: Number,
  followUpAt: Date,
  /** Links an outbound push/email log to its delivery record. */
  notificationId: { type: ObjectId, ref: "Notification" },
  attachments: { type: [attachmentSchema], validate: arrayMax(10) },
  actorType: { type: String, enum: ACTOR_TYPES, default: "admin" },
  actorId: { type: ObjectId },
  /** Dashboard reads it; avoids a populate. */
  actorName: String,
  occurredAt: { type: Date, default: Date.now }
};

export const configureSchema = (schema) => {
  schema.index({ entityType: 1, entityId: 1, occurredAt: -1 });
  schema.index({ entityType: 1 }); // [D] retain until 7-day post-deploy monitor; then drop
  schema.index({ entityId: 1 }); // [D] retain until 7-day post-deploy monitor; then drop
  schema.index({ channel: 1, occurredAt: -1 });
  schema.index({ actorId: 1, occurredAt: -1 }); // [N] "my activity", agent productivity reports
  schema.index({ followUpAt: 1 }, { sparse: true }); // [N] follow-up list

  applySchemaDefaults(schema);
};
