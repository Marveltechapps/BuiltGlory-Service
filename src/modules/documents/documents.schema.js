import mongoose from "mongoose";
import {
  DOCUMENT_STATUSES,
  DOCUMENT_OWNER_TYPES,
  DOCUMENT_PURPOSES,
  SCAN_STATUSES,
  ACTOR_TYPES
} from "../../constants/enums.js";
import { applySchemaDefaults } from "../../database/schemaCommon.js";

const { ObjectId } = mongoose.Schema.Types;

export const collectionName = "documents";

export const schemaDefinition = {
  referenceId: { type: String, required: true, unique: true, index: true },
  ownerType: { type: String, enum: DOCUMENT_OWNER_TYPES, required: true },
  ownerId: { type: ObjectId, required: true },
  purpose: { type: String, enum: DOCUMENT_PURPOSES, required: true },
  /**
   * Per-purpose vocabulary (e.g. kyc: pan | aadhaar | ...; legal: sale_deed | ec | khata | ...). Free string for now:
   * existing rows hold free text and sellerDocuments still infers term_sheet / sale_deed from file names.
   */
  documentType: String,
  fileName: { type: String, maxlength: 255 },
  mimeType: String,
  sizeBytes: { type: Number, min: 0 },
  /** Integrity check and duplicate detection. */
  sha256: { type: String, match: /^[a-fA-F0-9]{64}$/ },
  storageKey: String,
  /** Public vs private bucket. */
  bucket: String,
  /** Public media only. Private files are read through GET /documents/:id/read-url. */
  url: String,
  isPrivate: { type: Boolean, default: true },
  status: { type: String, enum: DOCUMENT_STATUSES, default: "uploaded" },
  scanStatus: { type: String, enum: SCAN_STATUSES, default: "pending" },
  scannedAt: Date,
  uploadedBy: ObjectId,
  uploadedByType: { type: String, enum: ACTOR_TYPES },
  verifiedBy: { type: ObjectId, ref: "Admin" },
  verifiedAt: Date,
  rejectionReason: String,
  /** Passport / visa expiry; drives the `expired` status. */
  expiresAt: Date,
  /** Re-uploads of the same document key. */
  version: { type: Number, default: 1, min: 1 },
  supersedesId: { type: ObjectId, ref: "Document" },
  /** Direct uploads that never complete are cleaned up after this. */
  uploadIntentExpiresAt: Date
};

export const configureSchema = (schema) => {
  schema.index({ ownerType: 1, ownerId: 1, purpose: 1 });
  schema.index({ status: 1, documentType: 1 });
  // [N] unique storage key (partial so legacy rows without a key do not collide on null)
  schema.index({ storageKey: 1 }, { unique: true, partialFilterExpression: { storageKey: { $type: "string" } } });
  schema.index({ scanStatus: 1, createdAt: 1 }); // [N] scan retry job
  schema.index({ uploadedBy: 1, createdAt: -1 }); // [N] user data export, abuse checks
  schema.index({ uploadIntentExpiresAt: 1 }, { sparse: true }); // [N] orphan cleanup

  applySchemaDefaults(schema);
};
