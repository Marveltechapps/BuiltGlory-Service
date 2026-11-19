import mongoose from "mongoose";
import { SELL_REQUEST_STATUSES, SCAN_STATUSES } from "../../constants/enums.js";
import {
  applySchemaDefaults,
  arrayMax,
  moneyField,
  normalizeKey,
  optionalGeoPointSchema,
  syncDerivedOnUpdate,
  userSnapshotSchema
} from "../../database/schemaCommon.js";

const { ObjectId, Mixed } = mongoose.Schema.Types;

export const collectionName = "sellRequests";

// Typed loan details; strict:false keeps any extra keys already stored (dual-read with the old Mixed field).
const loanDetailsSchema = new mongoose.Schema({
  lender: String,
  outstandingAmount: Number,
  emi: Number,
  noObjectionAvailable: Boolean
}, { _id: false, strict: false });

const sellerDocumentSchema = new mongoose.Schema({
  documentId: { type: ObjectId, ref: "Document" },
  /** Stable key, e.g. sale_deed, ec, khata, tax_receipt. */
  docKey: String,
  name: String,
  status: { type: String, enum: ["uploaded", "missing", "pending", "verified", "rejected"], default: "uploaded" },
  /** @deprecated private files are read through documents/:id/read-url. */
  fileUrl: String,
  scanStatus: { type: String, enum: [...SCAN_STATUSES, null] }
});

export const schemaDefinition = {
  referenceId: { type: String, required: true, unique: true, index: true },
  sellerId: { type: ObjectId, ref: "User", required: true },
  sellerSnapshot: { ...userSnapshotSchema },

  propertyTitle: { type: String, trim: true, maxlength: 200 },
  // Free string for now: the wizard/aliases ("Apartment", "plot", ...) are resolved server-side and tests use values
  // outside PROPERTY_TYPES. Tighten to PROPERTY_TYPES once aliases are normalised at write time.
  propertyType: String,
  askingPrice: moneyField(),
  negotiable: Boolean,
  address: {
    street: String,
    locality: String,
    localityKey: String,
    city: String,
    cityKey: String,
    state: String,
    pincode: String,
    landmark: String,
    location: { ...optionalGeoPointSchema },
    /** @deprecated use location. */
    latitude: Number,
    /** @deprecated use location. */
    longitude: Number
  },
  // Free strings: existing data uses display spellings ("Freehold"). See PropertySpecs.ownershipType for the target enum.
  ownershipType: String,
  possessionStatus: String,
  loanOnProperty: Boolean,
  loanDetails: loanDetailsSchema,

  photos: { type: [String], validate: arrayMax(30) },
  photoDocumentIds: [{ type: ObjectId, ref: "Document" }],
  photosCount: { type: Number, default: 0 },
  documentsCount: { type: Number, default: 0 },
  completenessPercent: { type: Number, default: 0, min: 0, max: 100 },
  description: { type: String, maxlength: 10000 },
  amenities: [String],
  // Same shape as properties.specs (Mixed until the typed migration), so conversion copies it 1:1.
  specifications: Mixed,
  documents: { type: [sellerDocumentSchema], validate: arrayMax(30) },

  status: { type: String, enum: SELL_REQUEST_STATUSES, default: "new" },
  /** Derived: status === "draft". Kept for clients that read it. */
  isDraft: { type: Boolean, default: false },
  draftStep: { type: Number, min: 1, max: 7 },
  draftSavedAt: Date,
  submittedAt: Date,
  /** P1: dashboard reads it. */
  duplicateOf: { type: ObjectId, ref: "SellRequest" },
  acquisitionId: { type: ObjectId, ref: "Acquisition" },
  /** Set when listed, so the tracker no longer needs sell request -> acquisition -> property hops. */
  propertyId: { type: ObjectId, ref: "Property" },
  assignedTo: { type: ObjectId, ref: "Admin" },
  sellerAvailability: { type: [String], default: [] },

  rejectionReason: String,
  pauseReason: String,
  /** Distinguishes "seller withdrew" from "admin paused". */
  withdrawnAt: Date,
  // Dual-read: legacy rows hold plain strings, new rows hold { field, message, requestedBy, requestedAt, resolvedAt }.
  changeRequests: { type: [Mixed], validate: arrayMax(30) },

  metrics: {
    views: { type: Number, default: 0 },
    enquiryCount: { type: Number, default: 0 },
    visitCount: { type: Number, default: 0 },
    saveCount: { type: Number, default: 0 },
    /** @deprecated read from propertyDailyStats. */
    viewsThisWeek: [Number]
  },
  sale: { salePrice: Number, saleDate: Date, buyerName: String }
};

export const configureSchema = (schema) => {
  schema.index({ sellerId: 1, status: 1, updatedAt: -1 }); // My Listings / My Drafts
  schema.index({ status: 1, assignedTo: 1, submittedAt: -1 }); // dashboard review queue
  schema.index({ "address.city": 1, propertyType: 1 }); // legacy
  schema.index({ "address.cityKey": 1, propertyType: 1 }); // [C] dashboard filter, duplicate detection
  schema.index({ acquisitionId: 1 }, { sparse: true });
  schema.index({ propertyTitle: "text", "address.locality": "text", "address.city": "text", referenceId: "text" });
  schema.index({ status: 1, draftSavedAt: 1 }, { partialFilterExpression: { status: "draft" } }); // draft reminder / cleanup

  schema.pre("validate", function deriveSellRequestFields() {
    if (this.isModified("address.city") || (this.address?.city && !this.address.cityKey)) {
      this.set("address.cityKey", normalizeKey(this.address?.city));
    }
    if (this.isModified("address.locality") || (this.address?.locality && !this.address.localityKey)) {
      this.set("address.localityKey", normalizeKey(this.address?.locality));
    }
    // Counters derived from the arrays. completenessPercent is intentionally left untouched (no formula yet).
    // (isSelected guards partially-projected documents so a missing array is not mistaken for an empty one.)
    if (this.isSelected("photos")) this.photosCount = this.photos?.length || 0;
    if (this.isSelected("documents")) this.documentsCount = this.documents?.length || 0;
    if (this.isNew || this.isModified("status")) {
      if (!this.isModified("isDraft") || this.isModified("status")) this.isDraft = this.status === "draft";
    }
  });

  syncDerivedOnUpdate(schema, "status", (status) => ({ isDraft: status === "draft" }));

  applySchemaDefaults(schema);
};
