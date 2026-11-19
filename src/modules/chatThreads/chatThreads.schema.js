import mongoose from "mongoose";
import { CHAT_STATUSES, MESSAGE_TYPES, OFFER_ACTIONS } from "../../constants/enums.js";
import {
  applySchemaDefaults,
  arrayMax,
  propertySnapshotSchema,
  userSnapshotSchema
} from "../../database/schemaCommon.js";

const { ObjectId } = mongoose.Schema.Types;

export const collectionName = "chatThreads";

/** Message types are MESSAGE_TYPES (now includes counter_offer, which the dashboard already renders). */
const messageSchema = new mongoose.Schema({
  sender: { type: String, enum: ["buyer", "admin", "system"] },
  senderId: ObjectId,
  senderName: String,
  type: { type: String, enum: MESSAGE_TYPES },
  text: { type: String, maxlength: 5000 },
  offerAmount: Number,
  offerStatus: { type: String, enum: ["pending", "accepted", "countered", "declined", "expired"] },
  /** Client retry de-duplication. */
  clientMessageId: { type: String, maxlength: 100 },
  createdAt: Date
});

export const schemaDefinition = {
  referenceId: { type: String, required: true, unique: true, index: true },
  buyerId: { type: ObjectId, ref: "User", required: true },
  buyerSnapshot: { ...userSnapshotSchema },
  propertyId: { type: ObjectId, ref: "Property", required: true },
  propertySnapshot: { ...propertySnapshotSchema },
  dealId: { type: ObjectId, ref: "SalesDeal" },
  enquiryId: { type: ObjectId, ref: "BuyEnquiry" },
  assignedTo: { type: ObjectId, ref: "Admin" },
  status: { type: String, enum: CHAT_STATUSES, default: "active" },

  negotiation: {
    listedPrice: Number,
    /** Latest offer so the dashboard does not scan messages. */
    currentOffer: {
      amount: Number,
      by: { type: String, enum: ["buyer", "admin"] },
      messageId: ObjectId,
      at: Date
    },
    agreedPrice: Number,
    deadline: Date,
    summary: { type: String, maxlength: 2000 },
    deadlineAlertAt: Date,
    longNegotiationAlert: { type: Boolean, default: false }
  },

  lastMessageAt: Date,
  lastMessagePreview: { type: String, maxlength: 200 },
  messageCount: { type: Number, default: 0, min: 0 },
  unreadBuyerCount: { type: Number, default: 0, min: 0 },
  unreadAgentCount: { type: Number, default: 0, min: 0 },

  /** @deprecated unbounded; moves to conversationMessages (conversationType: "chat_thread"). Dual-written until the API phase. */
  messages: [messageSchema],

  // "counter_created" is a legacy action written by respondToOffer(); kept valid alongside OFFER_ACTIONS.
  offerHistory: {
    type: [{
      messageId: ObjectId,
      action: { type: String, enum: [...OFFER_ACTIONS, "counter_created"] },
      amount: Number,
      actorId: ObjectId,
      actedAt: Date
    }],
    validate: arrayMax(200)
  },
  timeline: {
    type: [{
      event: String,
      messageId: ObjectId,
      actorId: ObjectId,
      amount: Number,
      createdAt: Date
    }],
    validate: arrayMax(200)
  }
};

export const configureSchema = (schema) => {
  schema.index({ buyerId: 1, propertyId: 1, status: 1 });
  schema.index({ lastMessageAt: -1 }); // legacy
  schema.index({ status: 1, lastMessageAt: -1 }); // [C]
  schema.index({ status: 1, "negotiation.deadline": 1 });
  schema.index({ dealId: 1 }, { sparse: true }); // [N]
  schema.index({ propertyId: 1, lastMessageAt: -1 }); // [N] seller tracker

  applySchemaDefaults(schema);
};
