import mongoose from "mongoose";
import {
  INTERIOR_LEAD_STATUSES,
  USER_TYPES,
  DESIGN_STYLES,
  BUDGET_RANGES,
  QUOTE_STATUSES
} from "../../constants/enums.js";
import {
  applySchemaDefaults,
  arrayMax,
  propertySnapshotSchema,
  userSnapshotSchema
} from "../../database/schemaCommon.js";

const { ObjectId } = mongoose.Schema.Types;

export const collectionName = "interiorLeads";

// strict:false keeps any extra quote keys already stored (e.g. the dashboard's legacy `totalPrice`).
const quoteSchema = new mongoose.Schema({
  amount: Number,
  packageName: String,
  /** Display string ("8-10 weeks"). */
  timeline: String,
  timelineWeeks: { type: Number, min: 0 },
  inclusions: { type: [String], validate: arrayMax(50) },
  terms: String,
  validUntil: Date,
  status: { type: String, enum: QUOTE_STATUSES },
  /** Quote PDF. */
  documentId: { type: ObjectId, ref: "Document" }
}, { _id: false, strict: false });

export const schemaDefinition = {
  referenceId: { type: String, required: true, unique: true, index: true },
  buyerId: { type: ObjectId, ref: "User", required: true },
  buyerSnapshot: { ...userSnapshotSchema },
  propertyId: { type: ObjectId, ref: "Property", required: true },
  propertySnapshot: { ...propertySnapshotSchema },
  /** Links to the deal's interior_design stage. */
  dealId: { type: ObjectId, ref: "SalesDeal" },
  // INTERIOR_ROOMS is the target vocabulary, but clients currently send free labels (Joi caps each at 80 chars),
  // so this is not enum-enforced yet.
  selectedRooms: { type: [String], validate: arrayMax(30) },
  designStyle: { type: String, enum: DESIGN_STYLES, required: true },
  budgetRange: { type: String, enum: BUDGET_RANGES, required: true },
  /** Matches adminSettings.tools.interiorPackages[].id */
  packageId: String,
  userType: { type: String, enum: USER_TYPES },
  status: { type: String, enum: INTERIOR_LEAD_STATUSES, default: "new" },
  slaDeadline: { type: Date, required: true },
  assignedDesigner: { type: ObjectId, ref: "Admin" },
  consultDate: Date,
  quote: quoteSchema,
  /** Negotiation produces several quotes. */
  quoteHistory: { type: [quoteSchema], validate: arrayMax(20) },
  customerAcceptedAt: Date,
  completionNote: String,
  remoteCoordinationNotes: String,
  notes: { type: String, maxlength: 5000 }
};

export const configureSchema = (schema) => {
  schema.index({ status: 1, slaDeadline: 1 });
  schema.index({ assignedDesigner: 1, status: 1 });
  schema.index({ buyerId: 1, createdAt: -1 });
  schema.index({ dealId: 1 }, { sparse: true }); // [N]

  applySchemaDefaults(schema);
};
