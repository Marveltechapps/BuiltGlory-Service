import mongoose from "mongoose";
import {
  BUY_ENQUIRY_STATUSES,
  ENQUIRY_CLOSED_REASONS,
  ENQUIRY_SOURCES,
  INTEREST_TYPES,
  PREFERRED_CONTACT,
  PREFERRED_VISIT_TIME
} from "../../constants/enums.js";
import {
  applySchemaDefaults,
  arrayMax,
  propertySnapshotSchema,
  syncDerivedOnUpdate,
  userSnapshotSchema
} from "../../database/schemaCommon.js";

const { ObjectId } = mongoose.Schema.Types;

export const collectionName = "buyEnquiries";

export const schemaDefinition = {
  referenceId: { type: String, required: true, unique: true, index: true },
  buyerId: { type: ObjectId, ref: "User", required: true },
  buyerSnapshot: { ...userSnapshotSchema },
  propertyId: { type: ObjectId, ref: "Property", required: true },
  propertySnapshot: { ...propertySnapshotSchema },
  /** Copied from properties.sellerId so the seller tracker can list enquiries by an indexed field. */
  sellerId: { type: ObjectId, ref: "User" },

  /**
   * ENQUIRY_TYPES (visit | price | documents | loan | nri_assistance | other) is the target vocabulary, but the
   * web app currently sends free-form tags ("Interest: ...") and tests send "buy", so this is NOT enum-enforced yet.
   * Tighten once clients are migrated.
   */
  enquiryTypes: { type: [{ type: String, trim: true, maxlength: 80 }], validate: arrayMax(10) },
  interestType: { type: String, enum: INTEREST_TYPES, default: "more_details", required: true },
  preferredContact: { type: String, enum: PREFERRED_CONTACT, required: true },
  preferredVisitTime: { type: String, enum: [...PREFERRED_VISIT_TIME, null], default: null },
  preferredVisitDate: Date,
  preferredVisitTimeSlot: String,
  additionalMessage: { type: String, maxlength: 1000 },

  status: { type: String, enum: BUY_ENQUIRY_STATUSES, default: "new" },
  /** Derived: status !== "closed". Backs the partial unique "one open enquiry per buyer per property" index. */
  isOpen: { type: Boolean, default: true },
  closedReason: { type: String, enum: [...ENQUIRY_CLOSED_REASONS, null] },
  cancelReason: { type: String, maxlength: 500 },
  cancelledAt: Date,
  source: { type: String, enum: ENQUIRY_SOURCES, default: "app" },

  assignedTo: { type: ObjectId, ref: "Admin" },
  /**
   * Set to the original enquiry when the service flags a repeat enquiry. Defaults to null so every non-duplicate
   * enquiry participates in the partial unique index (duplicates carry an ObjectId and are excluded from it).
   */
  duplicateOf: { type: ObjectId, ref: "BuyEnquiry", default: null },
  dealId: { type: ObjectId, ref: "SalesDeal" },
  /** P1: dashboard reads and writes it; previously silently dropped by strict mode. */
  notes: { type: String, maxlength: 5000 },

  firstResponseAt: Date,
  /** submittedAt + adminSettings.sla.enquiryHours */
  slaDeadline: Date,
  submittedAt: { type: Date, default: Date.now }
};

export const configureSchema = (schema) => {
  schema.index({ propertyId: 1, buyerId: 1, submittedAt: -1 }); // duplicate detection
  schema.index({ status: 1, assignedTo: 1 }); // legacy
  schema.index({ status: 1, assignedTo: 1, submittedAt: -1 }); // [C] dashboard queue sorted by age
  schema.index({ submittedAt: -1 });
  schema.index({ buyerId: 1, submittedAt: -1 }); // [N] GET /me/buy-enquiries
  schema.index({ sellerId: 1, submittedAt: -1 }, { sparse: true }); // [N] seller tracker
  schema.index({ status: 1, slaDeadline: 1 }, { partialFilterExpression: { status: "new" } }); // [N] SLA escalation job
  schema.index({ dealId: 1 }, { sparse: true }); // [N] deal -> enquiry back-reference
  // [N] At most one open (non-duplicate) enquiry per buyer per property. Race-free replacement for find-then-insert.
  schema.index(
    { propertyId: 1, buyerId: 1 },
    {
      unique: true,
      partialFilterExpression: { isOpen: true, isDeleted: false, duplicateOf: { $type: "null" } },
      name: "open_enquiry_unique_buyer_property"
    }
  );

  schema.pre("validate", function deriveIsOpen() {
    if (this.isNew || this.isModified("status")) this.isOpen = this.status !== "closed";
  });

  // The close path updates status through findByIdAndUpdate; keep isOpen in step.
  syncDerivedOnUpdate(schema, "status", (status) => ({ isOpen: status !== "closed" }));

  applySchemaDefaults(schema);
};
