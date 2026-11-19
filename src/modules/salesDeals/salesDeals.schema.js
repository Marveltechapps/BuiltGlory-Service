import mongoose from "mongoose";
import { SALES_DEAL_STAGES, PRIORITIES } from "../../constants/enums.js";
import {
  applySchemaDefaults,
  arrayMax,
  moneyField,
  paymentRecordSchema,
  propertySnapshotSchema,
  snapshotSubSchema,
  stageChangeSchema,
  syncDerivedOnUpdate,
  userSnapshotSchema
} from "../../database/schemaCommon.js";

const { ObjectId, Mixed } = mongoose.Schema.Types;

export const collectionName = "salesDeals";

/** Stages at which the property is reserved for this deal (cleared when the deal is lost / re-engaged). */
export const RESERVING_STAGES = ["token_payment", "full_payment", "stage_payment", "interior_design", "documentation", "closed"];

const outreachSchema = new mongoose.Schema({
  channel: String,
  notes: String,
  outcome: String,
  at: Date,
  by: { type: ObjectId, ref: "Admin" }
}, { strict: false });

export const schemaDefinition = {
  referenceId: { type: String, required: true, unique: true, index: true },
  stage: { type: String, enum: SALES_DEAL_STAGES, default: "active_leads" },
  priority: { type: String, enum: PRIORITIES, default: "normal" },
  buyerId: { type: ObjectId, ref: "User", required: true },
  // Typed (was Mixed). strict:false keeps any extra display keys clients still send.
  buyerSnapshot: snapshotSubSchema(userSnapshotSchema),
  propertyId: { type: ObjectId, ref: "Property", required: true },
  propertySnapshot: snapshotSubSchema({ ...propertySnapshotSchema, photos: { type: [String], default: undefined, validate: arrayMax(5) } }),
  sourceEnquiryId: { type: ObjectId, ref: "BuyEnquiry" },
  chatThreadId: { type: ObjectId, ref: "ChatThread" },
  interiorLeadId: { type: ObjectId, ref: "InteriorLead" },
  assignedTo: { type: ObjectId, ref: "Admin" },

  financials: {
    /** Snapshot of the property price at deal creation. */
    listedPrice: moneyField(),
    offeredPrice: Number,
    agreedPrice: Number,
    tokenAmount: Number,
    tokenPaid: { type: Boolean, default: false },
    /** Display snapshot of the verified token payment. The `payments` collection is the ledger. */
    tokenPayment: { ...paymentRecordSchema },
    tokenPaymentId: { type: ObjectId, ref: "Payment" },
    paymentType: { type: String, enum: ["full", "stage", null], default: null },
    totalPaid: { type: Number, default: 0 },
    /** Derived: agreedPrice - totalPaid. */
    balanceDue: Number,
    // Shapes still vary between dashboard releases (charges[], milestones[], rooms[], quote, ...), so these three
    // stay Mixed for dual-read. Typed replacements (Milestone, InteriorQuote) land with the API phase.
    fullPayment: Mixed,
    stagePayment: Mixed,
    interiorDesign: Mixed
  },

  daysInStage: { type: Number, default: 0 },
  // No schema default: a Date.now default would hydrate legacy docs with a fake "now" on read. New docs are stamped
  // in pre-save instead; legacy docs are backfilled by migration 2026-11-17-009.
  stageEnteredAt: { type: Date },
  lastActivityAt: Date,
  /** Derived: stage !== "lost". Backs the partial unique "one open deal per enquiry" index. */
  isOpen: { type: Boolean, default: true },
  /** Derived: stage reached token_payment or later and is not lost. Backs the "one reserving deal per property" index. */
  reservesProperty: { type: Boolean, default: false },

  /** P1: transition() writes notes; previously dropped by strict mode. */
  notes: { type: String, maxlength: 5000 },
  lostReason: String,
  lostNotes: String,
  lostAtStage: { type: String, enum: [...SALES_DEAL_STAGES, null] },
  lostAt: Date,
  closedAt: Date,

  reengagement: {
    followUpAt: Date,
    lastContactAt: Date,
    attempts: { type: Number, default: 0 },
    plan: { reason: String, offer: String, approach: String },
    outreach: { type: [outreachSchema], validate: arrayMax(100) }
  },

  // Hybrid: documentation stays Mixed (docs/docsRequired/registration/handoverChecklist/workflow keys are still
  // written by the dashboard in several shapes). Typed DealDocumentation is planned for the API phase.
  documentation: Mixed,

  /** @deprecated duplicate of propertySnapshot.photos. */
  photos: [String],
  stageHistory: { type: [{ ...stageChangeSchema }], validate: arrayMax(100) }
};

export const configureSchema = (schema) => {
  schema.index({ stage: 1, priority: 1, assignedTo: 1 }); // Kanban
  schema.index({ buyerId: 1, createdAt: -1 }); // legacy
  schema.index({ buyerId: 1, lastActivityAt: -1 }); // [C] GET /me/deals sorted by latest activity
  schema.index({ propertyId: 1, stage: 1 });
  // [C] One open deal per source enquiry (race-free). Replaces the plain { sourceEnquiryId: 1 } index.
  schema.index(
    { sourceEnquiryId: 1 },
    { unique: true, partialFilterExpression: { isOpen: true, isDeleted: false, sourceEnquiryId: { $type: "objectId" } } }
  );
  // [N] One reserving deal per property once it reaches token_payment.
  schema.index(
    { propertyId: 1 },
    {
      unique: true,
      partialFilterExpression: { reservesProperty: true, isDeleted: false },
      name: "deal_reserves_property_unique"
    }
  );
  schema.index({ stage: 1, closedAt: -1 }, { partialFilterExpression: { stage: "closed" } }); // revenue by month
  schema.index({ stage: 1, lastActivityAt: 1 }); // follow-up job / stale deals
  schema.index({ "reengagement.followUpAt": 1 }, { partialFilterExpression: { stage: "re_engagement" } }); // re-engagement queue

  const deriveFlags = (stage) => ({
    isOpen: stage !== "lost",
    reservesProperty: RESERVING_STAGES.includes(stage)
  });

  schema.pre("validate", function deriveDealFlags() {
    if (this.isNew || this.isModified("stage")) {
      const flags = deriveFlags(this.stage);
      this.isOpen = flags.isOpen;
      this.reservesProperty = flags.reservesProperty;
      if (!this.isNew && !this.isModified("stageEnteredAt")) this.stageEnteredAt = new Date();
    }
    const agreed = this.financials?.agreedPrice;
    if (agreed != null && (this.isModified("financials.agreedPrice") || this.isModified("financials.totalPaid"))) {
      this.financials.balanceDue = Math.max(0, Number(agreed) - Number(this.financials.totalPaid || 0));
    }
    if (this.stage === "lost" && !this.lostAt) this.lostAt = new Date();
  });

  schema.pre("save", function stampStageEnteredOnCreate() {
    if (this.isNew && !this.stageEnteredAt) this.stageEnteredAt = new Date();
  });

  // Stage changes made through findOneAndUpdate (transition()) keep the derived flags in step.
  syncDerivedOnUpdate(schema, "stage", (stage) => ({ ...deriveFlags(stage), stageEnteredAt: new Date() }));

  applySchemaDefaults(schema);
};
