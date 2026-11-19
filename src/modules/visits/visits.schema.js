import mongoose from "mongoose";
import {
  VISIT_STATUSES,
  VISIT_TYPES,
  VIRTUAL_PLATFORMS,
  VISIT_LANGUAGES,
  CALL_OUTCOMES,
  SELLER_VISIT_ACTIONS,
  BUYER_INTEREST,
  VISIT_NEXT_ACTIONS,
  ACTOR_TYPES
} from "../../constants/enums.js";
import {
  applySchemaDefaults,
  arrayMax,
  userSnapshotSchema,
  propertySnapshotSchema,
  actorRefSchema
} from "../../database/schemaCommon.js";

const { ObjectId } = mongoose.Schema.Types;

export const collectionName = "visits";

/** Statuses that occupy a bookable slot (drives the `slotActive` flag + unique slot index). */
export const SLOT_ACTIVE_STATUSES = ["scheduled", "confirmed", "rescheduled"];

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/**
 * Resolve `visitDate` (date-only) + `visitTime` ("11:00 AM" or "14:30") to the instant in Asia/Kolkata.
 * `visitDate` may be stored as 00:00 IST (new) or 00:00 UTC (legacy); adding the IST offset and reading the UTC
 * calendar parts yields the intended calendar day in both cases.
 * Returns undefined when it cannot be resolved.
 */
export const resolveVisitAt = (visitDate, visitTime) => {
  if (!visitDate) return undefined;
  const base = new Date(visitDate);
  if (Number.isNaN(base.getTime())) return undefined;
  const istParts = new Date(base.getTime() + IST_OFFSET_MS);
  let hours = 10;
  let minutes = 0;
  if (visitTime) {
    const text = String(visitTime).trim();
    const match12 = text.match(/^(1[0-2]|0?[1-9]):([0-5]\d)\s*(AM|PM)$/i);
    const match24 = text.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
    if (match12) {
      hours = Number(match12[1]) % 12;
      minutes = Number(match12[2]);
      if (match12[3].toUpperCase() === "PM") hours += 12;
    } else if (match24) {
      hours = Number(match24[1]);
      minutes = Number(match24[2]);
    } else {
      return undefined;
    }
  }
  const utcMs = Date.UTC(istParts.getUTCFullYear(), istParts.getUTCMonth(), istParts.getUTCDate(), hours, minutes) - IST_OFFSET_MS;
  return new Date(utcMs);
};

const noteSchema = new mongoose.Schema({
  text: { type: String, maxlength: 2000 },
  createdAt: Date,
  createdBy: { type: ObjectId, ref: "Admin" }
});

const callLogSchema = new mongoose.Schema({
  outcome: { type: String, enum: CALL_OUTCOMES },
  notes: String,
  duration: Number,
  calledAt: Date,
  calledBy: { type: ObjectId, ref: "Admin" }
});

const reminderSentSchema = new mongoose.Schema({
  kind: { type: String, enum: ["24h", "2h"], required: true },
  sentAt: { type: Date, default: Date.now }
}, { _id: false });

const rescheduleEntrySchema = new mongoose.Schema({
  previousDate: Date,
  previousTime: String,
  previousVisitAt: Date,
  newDate: Date,
  newTime: String,
  newVisitAt: Date,
  reason: String,
  actorType: { type: String, enum: [...ACTOR_TYPES, "buyer", "seller"] },
  actorId: ObjectId,
  changedAt: Date
}, { _id: false });

export const schemaDefinition = {
  referenceId: { type: String, required: true, unique: true, index: true },
  buyerId: { type: ObjectId, ref: "User", required: true },
  buyerSnapshot: { ...userSnapshotSchema },
  propertyId: { type: ObjectId, ref: "Property", required: true },
  propertySnapshot: { ...propertySnapshotSchema },
  sellerId: { type: ObjectId, ref: "User" },
  enquiryId: { type: ObjectId, ref: "BuyEnquiry" },
  dealId: { type: ObjectId, ref: "SalesDeal" },

  /** Date-only value (00:00 Asia/Kolkata). Legacy rows hold 00:00 UTC. */
  visitDate: { type: Date, required: true },
  /** Wall-clock slot, "h:mm AM". The dashboard may still send "HH:mm"; resolveVisitAt accepts both. */
  visitTime: { type: String, default: "10:00 AM" },
  /** Single instant (visitDate + visitTime in Asia/Kolkata) for "in the future" checks, reminders, sorting. */
  visitAt: Date,
  durationMinutes: { type: Number, default: 45, min: 15, max: 240 },
  visitType: { type: String, enum: VISIT_TYPES, required: true },
  virtualPlatform: { type: String, enum: [...VIRTUAL_PLATFORMS, null], default: null },
  meetingLink: String,
  /** @deprecated prefer virtualRecordingDocumentId (private storage). */
  virtualRecordingUrl: String,
  virtualRecordingDocumentId: { type: ObjectId, ref: "Document" },
  preferredLanguage: { type: String, enum: [...VISIT_LANGUAGES, null], default: null },

  status: { type: String, enum: VISIT_STATUSES, default: "scheduled" },
  /** true while status is scheduled/confirmed/rescheduled. Drives the slot-uniqueness partial index. */
  slotActive: { type: Boolean, default: true },
  assignedAdmin: { type: ObjectId, ref: "Admin" },

  sellerResponse: {
    action: { type: String, enum: SELLER_VISIT_ACTIONS },
    reason: String,
    respondedAt: Date
  },

  rescheduleCount: { type: Number, default: 0, min: 0, max: 5 },
  rescheduleHistory: { type: [rescheduleEntrySchema], validate: arrayMax(10) },

  feedback: {
    buyerInterest: { type: String, enum: [...BUYER_INTEREST, null], default: null },
    notes: { type: String, maxlength: 5000 },
    nextAction: { type: String, enum: [...VISIT_NEXT_ACTIONS, null], default: null },
    completedAt: Date
  },

  callDuration: Number,
  callNotes: { type: String, maxlength: 5000 },
  callLogs: { type: [callLogSchema], validate: arrayMax(50) },
  notes: { type: [noteSchema], validate: arrayMax(100) },
  documentsShared: { type: [String], validate: arrayMax(30) },
  followUpAction: String,
  followUpDate: Date,
  completedAt: Date,

  nriChecklist: { type: Map, of: Boolean, default: {} },
  nriAssistanceNotes: { type: String, maxlength: 5000 },

  /** @deprecated replaced by remindersSent[] (idempotent per reminder kind). Still readable/writable. */
  reminderSent: { type: Boolean, default: false },
  remindersSent: [{
    kind: { type: String, enum: ["24h", "2h"], required: true },
    sentAt: { type: Date, default: Date.now },
    _id: false
  }],

  cancelReason: { type: String, maxlength: 500 },
  cancelledBy: { ...actorRefSchema }
};

export const configureSchema = (schema) => {
  // Legacy visitDate-based indexes (kept until the API phase moves queries to visitAt).
  schema.index({ visitDate: 1, status: 1, assignedAdmin: 1 });
  schema.index({ buyerId: 1, visitDate: -1 });
  schema.index({ propertyId: 1, visitDate: -1 });

  // [C] visitAt-based replacements
  schema.index({ visitAt: 1, status: 1, assignedAdmin: 1 }); // dashboard calendar, reminder job
  schema.index({ buyerId: 1, visitAt: -1 }); // GET /me/visits
  schema.index({ propertyId: 1, visitAt: -1 }); // availability, seller tracker

  // [N] Database-enforced slot capacity (SLOT_CAPACITY = 1). Service maps E11000 to "slot no longer available".
  schema.index(
    { propertyId: 1, visitType: 1, visitAt: 1 },
    {
      unique: true,
      partialFilterExpression: { slotActive: true, isDeleted: false, visitAt: { $type: "date" } },
      name: "visit_slot_unique_active"
    }
  );
  // [N] enquiry -> visits
  schema.index({ enquiryId: 1 }, { sparse: true });
  // [N] follow-up job
  schema.index({ status: 1, "feedback.nextAction": 1 }, { partialFilterExpression: { status: "completed" } });

  schema.pre("validate", function deriveVisitFields() {
    // visitAt: compute when missing, or recompute when the date/time moved and visitAt was not set explicitly.
    const dateOrTimeMoved = this.isModified("visitDate") || this.isModified("visitTime");
    if (!this.visitAt || (dateOrTimeMoved && !this.isModified("visitAt"))) {
      const resolved = resolveVisitAt(this.visitDate, this.visitTime);
      if (resolved) this.visitAt = resolved;
    }
    // slotActive always follows status.
    if (this.isNew || this.isModified("status")) {
      if (!this.isModified("slotActive") || this.isModified("status")) {
        this.slotActive = SLOT_ACTIVE_STATUSES.includes(this.status);
      }
    }
  });

  // Update queries that change status (repository.update / findOneAndUpdate) keep slotActive consistent.
  const syncSlotActiveOnUpdate = function syncSlotActiveOnUpdate() {
    const update = this.getUpdate?.();
    if (!update || Array.isArray(update)) return;
    const $set = update.$set || {};
    const status = "status" in $set ? $set.status : update.status;
    const hasSlotActive = "slotActive" in $set || "slotActive" in update;
    if (typeof status === "string" && !hasSlotActive) {
      update.$set = { ...$set, slotActive: SLOT_ACTIVE_STATUSES.includes(status) };
    }
  };
  schema.pre("findOneAndUpdate", syncSlotActiveOnUpdate);
  schema.pre("updateOne", syncSlotActiveOnUpdate);
  schema.pre("updateMany", syncSlotActiveOnUpdate);

  applySchemaDefaults(schema);
};
