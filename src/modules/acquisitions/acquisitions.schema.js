import mongoose from "mongoose";
import { ACQUISITION_STAGES, PRIORITIES } from "../../constants/enums.js";
import {
  applySchemaDefaults,
  arrayMax,
  snapshotSubSchema,
  stageChangeSchema,
  syncDerivedOnUpdate,
  userSnapshotSchema
} from "../../database/schemaCommon.js";

const { ObjectId, Mixed } = mongoose.Schema.Types;

export const collectionName = "acquisitions";

export const schemaDefinition = {
  referenceId: { type: String, required: true, unique: true, index: true },
  stage: { type: String, enum: ACQUISITION_STAGES, default: "pending_review" },
  // No schema default: a Date.now default would hydrate legacy docs with a fake "now" on read. New docs are stamped
  // in pre-save instead; legacy docs are backfilled by migration 2026-11-17-009.
  stageEnteredAt: { type: Date },
  priority: { type: String, enum: PRIORITIES, default: "normal" },
  createdFrom: { type: String, enum: ["sell_request", "manual"], default: "sell_request" },
  sellRequestId: { type: ObjectId, ref: "SellRequest" },
  sellerId: { type: ObjectId, ref: "User" },
  // Typed (was Mixed). strict:false keeps any extra display keys already stored.
  sellerSnapshot: snapshotSubSchema(userSnapshotSchema),
  /** Set by convert-to-property. Canonical name (dashboard also reads convertedPropertyId). */
  propertyId: { type: ObjectId, ref: "Property" },

  propertyTitle: String,
  // Free string for now (see sellRequests.propertyType); tighten to PROPERTY_TYPES after alias normalisation.
  propertyType: String,
  propertyLocation: String,
  propertyCity: String,
  askingPrice: Number,
  /** Canonical location of the current offer (do not duplicate inside negotiation). */
  builtgloryOffer: Number,
  agreedPrice: Number,
  finalPurchasePrice: Number,

  assignedTo: { type: ObjectId, ref: "Admin" },
  daysInStage: { type: Number, default: 0 },
  lastActivityAt: Date,
  /** P1: dashboard reads `notes`; previously dropped by strict mode. */
  notes: { type: String, maxlength: 5000 },

  /** @deprecated top-level photos; read media.photos. */
  photos: [String],

  // The seven blobs below are still Mixed so both the legacy keys (documentation.registrationAppointment /
  // .registration, negotiation.builtgloryOffer, termSheetUrl / termSheet.url, ...) and the canonical typed
  // names can be read and written during the dual-read period. Typed AcqValuation / AcqNegotiation /
  // AcqDocumentation / AcqPayout replace them in the API phase.
  media: Mixed,
  propertyDetails: Mixed,
  valuation: Mixed,
  negotiation: Mixed,
  token: Mixed,
  documentation: Mixed,
  payout: Mixed,

  rejectionReason: String,
  /** Promoted from documentation.workflow.rejectedStage. */
  rejectedAtStage: { type: String, enum: [...ACQUISITION_STAGES, null] },
  onHoldReason: String,
  /** Resume target when on_hold. Promoted from documentation.workflow.prevStage. */
  previousStage: { type: String, enum: [...ACQUISITION_STAGES, null] },
  stageHistory: { type: [{ ...stageChangeSchema }], validate: arrayMax(100) }
};

export const configureSchema = (schema) => {
  schema.index({ stage: 1, priority: 1, assignedTo: 1 }); // Kanban
  // Seller tracker lookup. NOT unique yet: the service allows a new acquisition once the previous one for the same
  // sell request is rejected (create() only blocks `stage != rejected`). A unique "one active acquisition per sell
  // request" index needs an `isOpen`-style flag (partial indexes cannot express $nin) - deferred to the API phase.
  schema.index({ sellRequestId: 1 }, { sparse: true });
  schema.index({ lastActivityAt: -1 });
  schema.index({ sellerId: 1, sellRequestId: 1, createdAt: -1 }); // [N] seller tracker findOne(...).sort(createdAt desc)
  schema.index({ stage: 1, "negotiation.deadline": 1 }); // [N] offer expiry job
  schema.index({ propertyId: 1 }, { sparse: true }); // [N] property -> acquisition

  schema.pre("validate", function stampStageEntered() {
    if (!this.isNew && this.isModified("stage") && !this.isModified("stageEnteredAt")) this.stageEnteredAt = new Date();
  });
  schema.pre("save", function stampStageEnteredOnCreate() {
    if (this.isNew && !this.stageEnteredAt) this.stageEnteredAt = new Date();
  });
  syncDerivedOnUpdate(schema, "stage", () => ({ stageEnteredAt: new Date() }));

  applySchemaDefaults(schema);
};
