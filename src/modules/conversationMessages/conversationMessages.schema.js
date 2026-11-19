import mongoose from "mongoose";
import { ACTOR_TYPES, CONVERSATION_TYPES, MESSAGE_TYPES } from "../../constants/enums.js";
import { applySchemaDefaults, arrayMax, attachmentRefSchema, moneyField } from "../../database/schemaCommon.js";

/** conversationMessages (DATABASE_ARCHITECTURE.md §9.2). No referenceId: never shown as a standalone record. */
export const collectionName = "conversationMessages";

export const OFFER_STATUSES = ["pending", "accepted", "countered", "declined", "expired"];
const OFFER_MESSAGE_TYPES = ["offer", "counter_offer", "deal_agreed"];

const isOfferMessage = function isOfferMessage() {
  return OFFER_MESSAGE_TYPES.includes(this.type);
};

export const schemaDefinition = {
  conversationType: { type: String, enum: CONVERSATION_TYPES, required: true },
  conversationId: { type: mongoose.Schema.Types.ObjectId, required: true },
  seq: { type: Number, required: true, min: 1 },
  senderType: { type: String, enum: ACTOR_TYPES, required: true },
  senderId: { type: mongoose.Schema.Types.ObjectId },
  senderName: { type: String, trim: true, maxlength: 200 },
  type: { type: String, enum: MESSAGE_TYPES, required: true },
  text: {
    type: String,
    maxlength: 5000,
    required() { return this.type === "text"; }
  },
  offer: {
    _id: false,
    amount: moneyField({ required: isOfferMessage }),
    status: { type: String, enum: OFFER_STATUSES, required: isOfferMessage }
  },
  attachments: {
    type: [{ _id: false, ...attachmentRefSchema }],
    default: undefined,
    validate: arrayMax(10)
  },
  clientMessageId: { type: String, trim: true, maxlength: 100 },
  readBy: {
    type: [{
      _id: false,
      actorType: { type: String, enum: ACTOR_TYPES, required: true },
      actorId: { type: mongoose.Schema.Types.ObjectId },
      readAt: { type: Date, default: Date.now }
    }],
    default: undefined,
    validate: arrayMax(10)
  },
  editedAt: { type: Date }
};

export const configureSchema = (schema) => {
  applySchemaDefaults(schema);
  // Thread page, newest first; "load older" with seq < x.
  schema.index({ conversationType: 1, conversationId: 1, seq: -1 }, { unique: true });
  // Idempotent send (client retry de-duplication).
  schema.index(
    { conversationType: 1, conversationId: 1, clientMessageId: 1 },
    { unique: true, partialFilterExpression: { clientMessageId: { $type: "string" } } }
  );
  // Moderation / user export.
  schema.index({ senderId: 1, createdAt: -1 });
};
