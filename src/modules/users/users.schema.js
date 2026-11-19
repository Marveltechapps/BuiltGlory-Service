import mongoose from "mongoose";
import {
  USER_TYPES,
  CUSTOMER_ROLES,
  KYC_STATUSES,
  FEMA_STATUSES,
  DOCUMENT_STATUSES,
  KYC_DOCUMENT_TYPES,
  APP_LANGUAGES,
  DEVICE_PLATFORMS
} from "../../constants/enums.js";
import {
  applySchemaDefaults,
  arrayMax,
  channelPreferenceSchema,
  optionalGeoPointSchema
} from "../../database/schemaCommon.js";

const { ObjectId } = mongoose.Schema.Types;

/**
 * Document types that the compliance matrix (complianceRules.service.js) already uses for NRI/PIO flows but that are
 * not part of the canonical KYC_DOCUMENT_TYPES list. Kept readable/writable so existing data does not fail validation.
 */
const LEGACY_KYC_DOCUMENT_TYPES = [
  "overseas_address_proof",
  "pio_card",
  "fema_declaration",
  "source_of_funds",
  "nre_nro_account_proof",
  "pio_oci_proof"
];

const kycDocumentSchema = new mongoose.Schema({
  name: String,
  type: { type: String, enum: [...KYC_DOCUMENT_TYPES, ...LEGACY_KYC_DOCUMENT_TYPES] },
  /** Legacy alias of `type` (compliance rules read `doc.type || doc.documentType`). */
  documentType: String,
  /** Source of truth for the file: reference to the `documents` collection. */
  documentId: { type: ObjectId, ref: "Document" },
  status: { type: String, enum: DOCUMENT_STATUSES, default: "uploaded" },
  /** @deprecated Private files must be read through GET /documents/:id/read-url. */
  fileUrl: String,
  uploadedAt: Date,
  verifiedAt: Date,
  verifiedBy: { type: ObjectId, ref: "Admin" },
  rejectionReason: { type: String, maxlength: 500 },
  /** Passport / visa expiry so a job can set the `expired` status. */
  expiresAt: Date
}, { _id: true });

const STAT_KEYS = ["totalEnquiries", "totalVisits", "totalDeals", "totalListings"];
const counter = () => ({ type: Number, default: 0, min: 0 });

export const collectionName = "users";

export const schemaDefinition = {
  referenceId: { type: String, required: true, unique: true, index: true },
  name: { type: String, minlength: 2, maxlength: 120, trim: true },

  // Contact identity. Uniqueness is declared in configureSchema with partialFilterExpression ($type: "string")
  // so both missing AND null values are ignored (sparse only ignores missing).
  countryCode: { type: String, match: /^\+\d{1,4}$/, default: "+91" },
  mobileNumber: { type: String, match: /^\d{10}$/ },
  phone: { type: String },
  phoneNormalized: { type: String },
  email: { type: String, lowercase: true, trim: true },

  /** @deprecated Plaintext OTP. Phone OTPs live in Redis only; a migration unsets these. Kept readable (select:false). */
  otp: { type: String, default: null, select: false },
  /** @deprecated see `otp`. */
  otpExpiry: { type: Date, default: null, select: false },

  isVerified: { type: Boolean, default: false },
  isEmailVerified: { type: Boolean, default: false },
  emailVerifiedAt: Date,
  passwordHash: { type: String, select: false },
  passwordUpdatedAt: Date,

  preferences: { language: { type: String, enum: APP_LANGUAGES, default: "en" } },
  privacy: {
    personalise: { type: Boolean, default: true },
    shareWithSellers: { type: Boolean, default: false },
    analytics: { type: Boolean, default: true },
    location: { type: Boolean, default: false },
    /** Consent timestamp (DPDP Act). */
    updatedAt: Date
  },

  userType: { type: String, enum: USER_TYPES, default: "resident" },
  role: { type: String, enum: CUSTOMER_ROLES, default: "buyer" },

  profilePhoto: String,
  profilePhotoDocumentId: { type: ObjectId, ref: "Document" },
  city: { type: String, trim: true, maxlength: 80 },
  state: { type: String, trim: true, maxlength: 80 },
  country: { type: String, default: "India" },
  /** GeoJSON [lng, lat]. Replaces latitude/longitude for geo queries. */
  location: { ...optionalGeoPointSchema },
  /** @deprecated use `location`. Kept readable until clients stop sending them. */
  latitude: { type: Number, min: -90, max: 90 },
  /** @deprecated use `location`. */
  longitude: { type: Number, min: -180, max: 180 },

  bankDetails: {
    accountHolderName: { type: String, trim: true, minlength: 2, maxlength: 120 },
    bankName: { type: String, trim: true, maxlength: 120 },
    accountNumberLast4: { type: String, match: /^\d{4}$/ },
    ifsc: { type: String, trim: true, uppercase: true, match: /^[A-Z]{4}0[A-Z0-9]{6}$/ },
    branch: { type: String, trim: true, maxlength: 120 },
    upiId: { type: String, trim: true, match: /^[\w.\-]{2,256}@[a-zA-Z]{2,64}$/ },
    /** Payment-provider vault id (e.g. RazorpayX fund account). The full account number is never stored in MongoDB. */
    providerFundAccountId: { type: String, trim: true },
    updatedAt: Date
  },

  kycStatus: { type: String, enum: KYC_STATUSES, default: "not_submitted" },
  kycDocuments: { type: [kycDocumentSchema], validate: arrayMax(10) },
  kycSubmittedAt: Date,
  kycVerifiedAt: Date,
  kycRejectionReason: { type: String, maxlength: 500 },

  femaCompliance: {
    status: { type: String, enum: FEMA_STATUSES, default: "not_checked" },
    checkedBy: { type: ObjectId, ref: "Admin" },
    checkedAt: Date,
    notes: { type: String, maxlength: 2000 }
  },

  notificationPreferences: {
    sms: { ...channelPreferenceSchema },
    whatsapp: { ...channelPreferenceSchema },
    email: { ...channelPreferenceSchema },
    push: { ...channelPreferenceSchema },
    in_app: { ...channelPreferenceSchema },
    unsubscribeToken: { type: String, select: false }
  },

  /** @deprecated Moves to the `devices` collection. Dual-written until the API phase ships. */
  pushDevices: [{
    token: { type: String, required: true },
    platform: { type: String, enum: DEVICE_PLATFORMS, default: "android" },
    deviceId: String,
    updatedAt: { type: Date, default: Date.now }
  }],

  accountDeletion: {
    status: { type: String, enum: ["none", "requested", "cancelled", "completed"], default: "none" },
    reason: { type: String, maxlength: 1000 },
    verificationStatus: { type: String, enum: ["not_started", "pending", "verified", "failed"], default: "not_started" },
    requestedAt: Date,
    scheduledDeletionAt: Date,
    cancelledAt: Date,
    completedAt: Date,
    lastUpdatedBy: { type: ObjectId, ref: "User" }
  },

  // Counters. Canonical location is `stats.*`; the top-level totals are kept in sync (pre-validate hook) for
  // existing clients/queries that still read them.
  stats: {
    totalEnquiries: counter(),
    totalVisits: counter(),
    totalDeals: counter(),
    totalListings: counter()
  },
  /** @deprecated mirrored from stats.totalEnquiries */
  totalEnquiries: { type: Number, default: 0 },
  /** @deprecated mirrored from stats.totalVisits */
  totalVisits: { type: Number, default: 0 },
  /** @deprecated mirrored from stats.totalDeals */
  totalDeals: { type: Number, default: 0 },
  /** @deprecated mirrored from stats.totalListings */
  totalListings: { type: Number, default: 0 },

  registeredAt: { type: Date, default: Date.now },
  lastLoginAt: Date,
  isActive: { type: Boolean, default: true },
  isBlocked: { type: Boolean, default: false },
  blockedReason: { type: String, maxlength: 500 },
  blockedAt: Date,
  blockedBy: { type: ObjectId, ref: "Admin" },
  assignedTo: { type: ObjectId, ref: "Admin" },
  /** Set by the account-deletion job once PII has been anonymised. */
  anonymizedAt: Date
};

export const configureSchema = (schema) => {
  // Identity / contact uniqueness. partialFilterExpression ignores documents where the field is missing OR null.
  // Writes should still $unset rather than set null.
  schema.index({ phoneNormalized: 1 }, { unique: true, partialFilterExpression: { phoneNormalized: { $type: "string" } } });
  schema.index({ mobileNumber: 1 }, { unique: true, partialFilterExpression: { mobileNumber: { $type: "string" } } });
  schema.index({ email: 1 }, { unique: true, partialFilterExpression: { email: { $type: "string" } } });

  schema.index({ role: 1, userType: 1, kycStatus: 1 });
  schema.index({ isBlocked: 1, isActive: 1 });
  schema.index({ name: "text", phone: "text", email: "text", referenceId: "text" });
  // [N] KYC review queue, oldest first
  schema.index({ kycStatus: 1, kycSubmittedAt: 1 });
  // [N] FEMA review queue
  schema.index({ "femaCompliance.status": 1, userType: 1 });
  // [N] "My customers" for relationship managers
  schema.index({ assignedTo: 1, createdAt: -1 });
  // [N] Account deletion job
  schema.index(
    { "accountDeletion.status": 1, "accountDeletion.scheduledDeletionAt": 1 },
    { partialFilterExpression: { "accountDeletion.status": "requested" } }
  );
  // [N] New-user reports, export
  schema.index({ createdAt: -1 });

  schema.virtual("profileComplete").get(function profileComplete() {
    return Boolean(this.name && this.phoneNormalized && this.role && this.userType);
  });

  // Keep stats.* and the deprecated top-level totals in sync (either side may be the one that was written).
  schema.pre("validate", function syncStats() {
    for (const key of STAT_KEYS) {
      const nestedPath = `stats.${key}`;
      if (this.isModified(nestedPath) && !this.isModified(key)) {
        this[key] = this.get(nestedPath);
      } else if (this.isModified(key) && !this.isModified(nestedPath)) {
        this.set(nestedPath, this.get(key));
      }
    }
  });

  schema.set("toJSON", {
    virtuals: true,
    transform: (_doc, ret) => {
      delete ret.otp;
      delete ret.otpExpiry;
      delete ret.passwordHash;
      if (ret.notificationPreferences) delete ret.notificationPreferences.unsubscribeToken;
      return ret;
    }
  });

  applySchemaDefaults(schema);
};
