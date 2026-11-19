import mongoose from "mongoose";
import {
  SUPPORT_TICKET_STATUSES,
  SUPPORT_CATEGORIES,
  SUPPORT_PRIORITIES,
  SUPPORT_CHANNELS,
  ENTITY_TYPES
} from "../../constants/enums.js";
import {
  actorRefSchema,
  applySchemaDefaults,
  syncDerivedOnUpdate,
  userSnapshotSchema
} from "../../database/schemaCommon.js";

const { ObjectId } = mongoose.Schema.Types;

export const collectionName = "supportTickets";

/** Ticket statuses that count as open (live-chat uniqueness, dashboard queues). */
export const OPEN_TICKET_STATUSES = ["open", "in_progress"];
const DEFAULT_SLA_MS = 24 * 60 * 60 * 1000;

export const schemaDefinition = {
  referenceId: { type: String, required: true, unique: true, index: true },
  userId: { type: ObjectId, ref: "User", required: true },
  /** Dashboard reads userName / phone / email from here. */
  userSnapshot: { ...userSnapshotSchema },
  category: { type: String, enum: SUPPORT_CATEGORIES, required: true },
  subject: { type: String, required: true, maxlength: 200 },
  /** Opening message (also written as the first conversationMessages row once that collection ships). */
  message: { type: String, required: true, maxlength: 5000 },
  status: { type: String, enum: SUPPORT_TICKET_STATUSES, default: "open" },
  /** Derived: status in { open, in_progress }. Backs the "one open live chat per user" partial unique index. */
  isOpen: { type: Boolean, default: true },
  priority: { type: String, enum: SUPPORT_PRIORITIES, default: "medium" },
  channel: { type: String, enum: SUPPORT_CHANNELS, default: "ticket", index: true },
  /** Ticket about a payment, visit, listing, ... */
  relatedEntity: {
    entityType: { type: String, enum: ENTITY_TYPES },
    entityId: ObjectId
  },
  assignedTo: { type: ObjectId, ref: "Admin" },
  escalation: {
    targetAssignee: { type: ObjectId, ref: "Admin" },
    reason: String,
    escalatedAt: Date,
    escalatedBy: { type: ObjectId, ref: "Admin" }
  },
  slaDeadline: { type: Date, default: () => new Date(Date.now() + DEFAULT_SLA_MS) },
  firstResponseAt: Date,
  resolvedAt: Date,
  /** Resolution note sent by the dashboard on PATCH (accepted by updateValidator). */
  resolutionResponse: { type: String, maxlength: 5000 },
  closedAt: Date,
  reopenedAt: Date,
  /** Customer "Mark as resolved" vs agent resolution. */
  resolvedBy: { ...actorRefSchema },

  /** @deprecated attachments move onto messages as documentIds. */
  attachments: [String],
  /** Preview only (<= 200 chars by convention; not length-enforced so existing longer previews stay valid). */
  lastMessage: { type: String, default: "" },
  lastMessageAt: { type: Date },
  messageCount: { type: Number, default: 0, min: 0 },
  unreadCustomerCount: { type: Number, default: 0, min: 0 },
  unreadAgentCount: { type: Number, default: 0, min: 0 },

  /** @deprecated unbounded; moves to conversationMessages. Dual-written until the API phase. */
  responses: [
    {
      message: { type: String, required: true },
      responderType: { type: String, enum: ["admin", "customer", "system"], required: true },
      responderId: { type: ObjectId },
      clientMessageId: { type: String },
      readAt: { type: Date },
      createdAt: { type: Date, default: Date.now }
    }
  ],

  /** CSAT after resolution (P3). */
  satisfaction: {
    rating: { type: Number, min: 1, max: 5 },
    comment: { type: String, maxlength: 1000 },
    ratedAt: Date
  }
};

export const configureSchema = (schema) => {
  schema.index({ status: 1, priority: 1, assignedTo: 1 });
  schema.index({ userId: 1, createdAt: -1 });
  schema.index({ userId: 1, status: 1, channel: 1 });
  schema.index({ channel: 1, status: 1, lastMessageAt: -1 });
  schema.index({ createdAt: -1 });
  // @deprecated: moves to conversationMessages.clientMessageId.
  schema.index({ "responses.clientMessageId": 1 }, { sparse: true });
  // [N] overdue-ticket job (previously a collection scan)
  schema.index({ status: 1, slaDeadline: 1 });
  // [N] at most one open live-chat ticket per user
  schema.index(
    { userId: 1, channel: 1 },
    {
      unique: true,
      partialFilterExpression: { isOpen: true, channel: "live_chat", isDeleted: false },
      name: "open_live_chat_unique_user"
    }
  );

  schema.pre("validate", function deriveTicketFields() {
    if (this.isNew || this.isModified("status")) this.isOpen = OPEN_TICKET_STATUSES.includes(this.status);
  });
  syncDerivedOnUpdate(schema, "status", (status) => ({ isOpen: OPEN_TICKET_STATUSES.includes(status) }));

  applySchemaDefaults(schema);
};
