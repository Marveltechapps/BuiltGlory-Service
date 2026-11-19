import mongoose from "mongoose";
import { applySchemaDefaults } from "../../database/schemaCommon.js";

const { ObjectId, Mixed } = mongoose.Schema.Types;

const schema = new mongoose.Schema(
  {
    referenceId: { type: String, required: true, unique: true, index: true },
    status: { type: String, enum: ["queued", "scheduled", "sent", "partial", "failed"], default: "queued", index: true },
    channel: { type: String, enum: ["whatsapp", "email", "sms", "in_app", "all"], required: true },
    // Free string: admins send "all", "buyers", "sellers", "nri", "kyc", ...
    audience: { type: String, default: "all", index: true },
    /** Filter resolved at send time ({ role, userType, city, kycStatus, ... }); replaces storing every recipient. */
    audienceFilter: { type: Mixed },
    title: { type: String, trim: true },
    message: { type: String, required: true },
    templateId: { type: String },
    /**
     * Whether the send is marketing (must respect opt-outs). Defaults to false to match the current controller
     * (`marketing = false`); the architecture suggests marketing-by-default, which is an API-phase decision.
     */
    marketing: { type: Boolean, default: false },
    /** @deprecated for audience:"all" this can hold every user's contact (16 MB risk); store audienceFilter instead. */
    recipients: [{ type: String }],
    queuedCount: { type: Number, default: 0 },
    /** Replaces queuedCount going forward. */
    counts: {
      targeted: { type: Number, default: 0, min: 0 },
      queued: { type: Number, default: 0, min: 0 },
      sent: { type: Number, default: 0, min: 0 },
      delivered: { type: Number, default: 0, min: 0 },
      failed: { type: Number, default: 0, min: 0 }
    },
    /** @deprecated reverse it: notifications.bulkMessageId. */
    notificationIds: [{ type: ObjectId, ref: "Notification" }],
    scheduledAt: Date,
    sentAt: Date,
    requestedBy: { type: ObjectId, ref: "Admin", index: true },
    failureReason: String
  },
  {
    timestamps: true,
    collection: "bulkMessages",
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

schema.index({ createdAt: -1 });
schema.index({ status: 1, scheduledAt: 1 }); // [N] scheduled-send job

applySchemaDefaults(schema);

export const BulkMessage = mongoose.models.BulkMessage || mongoose.model("BulkMessage", schema);
