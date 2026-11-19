import mongoose from "mongoose";
import { NOTIFICATION_CHANNELS, NOTIFICATION_STATUSES, NOTIFICATION_AUDIENCES } from "../../constants/enums.js";
import { applySchemaDefaults } from "../../database/schemaCommon.js";

const { ObjectId, Mixed } = mongoose.Schema.Types;

export const collectionName = "notifications";

export const schemaDefinition = {
  referenceId: { type: String, required: true, unique: true, index: true },
  userId: { type: ObjectId, ref: "User" },
  adminId: { type: ObjectId, ref: "Admin" },
  audience: { type: String, enum: NOTIFICATION_AUDIENCES },
  event: { type: String, required: true },
  notificationType: String,
  channel: { type: String, enum: NOTIFICATION_CHANNELS, required: true },

  // title/message are intentionally not length-capped: dropping an over-long enqueue would lose the notification.
  // Target limits (title <= 120, message <= 1000) are enforced by the Joi layer / catalog copy.
  title: String,
  message: String,
  image: String,

  // entityType is the shared ENTITY_TYPES vocabulary but is not enum-enforced yet: producers still send "" or
  // legacy values. entityId stays a String (producers pass strings, sometimes empty) until it migrates to ObjectId.
  entityType: String,
  entityId: String,
  /** @deprecated duplicates of entityType/entityId; move into deepLink. */
  listingId: String,
  /** @deprecated */
  enquiryId: String,
  /** @deprecated */
  propertyId: String,
  /** @deprecated */
  dealId: String,
  /** @deprecated replaced by deepLink.screen. */
  screen: String,
  deepLink: {
    screen: String,
    screenKey: String,
    params: { type: Map, of: String }
  },

  /** Queue dedupe key. Unique per channel (partial index) so dedupe is race-free; previously only payload.dedupeKey. */
  dedupeKey: { type: String, maxlength: 300 },
  bulkMessageId: { type: ObjectId, ref: "BulkMessage" },
  templateId: String,
  /** phone / email / token hash. Required for non-in-app channels (enforced by the service). */
  recipient: String,
  payload: Mixed,
  marketing: { type: Boolean, default: false },
  preferenceCheckedAt: Date,

  // ---- Delivery ----
  status: { type: String, enum: NOTIFICATION_STATUSES, default: "queued" },
  attempts: { type: Number, default: 0 },
  maxAttempts: { type: Number, default: 5 },
  nextAttemptAt: Date,
  /** Claim a row before sending so two job runners cannot send twice. */
  lockedUntil: Date,
  lockedBy: String,
  provider: String,
  providerMessageId: String,
  providerResponse: { type: Mixed, select: false },
  sentAt: Date,
  deliveredAt: Date,
  failedAt: Date,
  deadLetterAt: Date,
  failureReason: String,

  // ---- Inbox ----
  isRead: { type: Boolean, default: false },
  readAt: Date,
  archivedAt: Date,
  /**
   * Retention timestamp (channel-based: in-app 180d, delivery log 90d).
   * PENDING PRODUCT APPROVAL: the TTL index on `expiresAt` is intentionally NOT created yet.
   */
  expiresAt: Date
};

export const configureSchema = (schema) => {
  schema.index({ status: 1, nextAttemptAt: 1 }); // queue worker
  schema.index({ userId: 1, channel: 1, isDeleted: 1, createdAt: -1 }); // [C] GET /me/notifications (channel: in_app)
  schema.index({ userId: 1, channel: 1, isRead: 1 }, { partialFilterExpression: { isRead: false } }); // [N] unread badge
  schema.index({ isRead: 1 }); // [D] retain until 7-day post-deploy monitor; then drop
  schema.index({ adminId: 1, createdAt: -1 }); // admin inbox
  schema.index({ event: 1, channel: 1 }); // admin notification log filters
  // [N] race-free dedupe
  schema.index(
    { dedupeKey: 1, channel: 1 },
    { unique: true, partialFilterExpression: { dedupeKey: { $type: "string" } } }
  );
  schema.index({ bulkMessageId: 1, status: 1 }, { sparse: true }); // [N] bulk campaign progress
  // NOTE: { expiresAt: 1 } TTL (expireAfterSeconds: 0) is deliberately not declared until retention is approved.

  applySchemaDefaults(schema);
};
