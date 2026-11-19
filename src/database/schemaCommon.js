import mongoose from "mongoose";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";

/** Current schemaVersion stamped on new/updated documents. Bump when a collection shape changes. */
export const CURRENT_SCHEMA_VERSION = 1;

export const DELETED_BY_TYPES = ["admin", "customer", "system"];

export const geoPointSchema = {
  type: { type: String, enum: ["Point"], default: "Point" },
  coordinates: {
    type: [Number],
    validate: {
      validator(value) {
        if (!value || value.length === 0) return true;
        return value.length === 2
          && value[0] >= -180 && value[0] <= 180
          && value[1] >= -90 && value[1] <= 90;
      },
      message: "GeoJSON Point coordinates must be [lng, lat]"
    }
  }
};

export const userSnapshotSchema = {
  name: String,
  phone: String,
  email: String,
  userType: String,
  kycStatus: String
};

export const propertySnapshotSchema = {
  title: String,
  // Declared as `{ type: String }` (not bare `String`) so Mongoose treats this as a field named "type"
  // instead of the declared type of the whole snapshot object.
  type: { type: String },
  price: Number,
  location: String,
  city: String,
  coverPhoto: String,
  /** @deprecated legacy alias of coverPhoto still read by push/notification code. */
  coverImage: String,
  photos: { type: [String], default: undefined }
};

export const adminSnapshotSchema = {
  name: String,
  phone: String,
  photoUrl: String,
  rating: Number
};

export const channelPreferenceSchema = {
  transactional: { type: Boolean, default: true },
  marketing: { type: Boolean, default: false },
  optedOutAt: Date
};

export const moneyField = (extra = {}) => ({
  type: Number,
  min: 0,
  validate: {
    validator(value) {
      if (value == null) return true;
      return Number.isInteger(value) && value >= 0 && value <= 5_000_000_000;
    },
    message: "Money must be an integer INR amount between 0 and 5000000000"
  },
  ...extra
});

export const positiveMoneyField = (extra = {}) => ({
  type: Number,
  min: 1,
  validate: {
    validator(value) {
      if (value == null) return true;
      return Number.isInteger(value) && value >= 1 && value <= 5_000_000_000;
    },
    message: "Money must be an integer INR amount between 1 and 5000000000"
  },
  ...extra
});

export const docStatusSchema = {
  status: {
    type: String,
    enum: ["missing", "requested", "pending", "uploaded", "verified", "rejected", "sent"],
    default: "missing"
  },
  documentId: { type: mongoose.Schema.Types.ObjectId, ref: "Document" },
  fileName: String,
  rejectionReason: String,
  updatedAt: Date,
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" }
};

export const paymentRecordSchema = {
  paymentId: { type: mongoose.Schema.Types.ObjectId, ref: "Payment" },
  amount: Number,
  method: { type: String, enum: ["neft", "upi", "cheque", "cash", "razorpay", "rtgs", "bank"] },
  reference: String,
  paymentDate: Date,
  proofDocumentId: { type: mongoose.Schema.Types.ObjectId, ref: "Document" },
  proofUrl: String,
  notes: String,
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
  verifiedAt: Date
};

export const stageChangeSchema = {
  from: String,
  to: String,
  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
  changedAt: { type: Date, default: Date.now },
  enteredAt: Date,
  notes: String
};

export const registrationAppointmentSchema = {
  date: Date,
  time: String,
  office: String,
  subRegistrar: String,
  address: String,
  done: Boolean,
  completedAt: Date,
  status: { type: String, enum: ["pending", "scheduled", "completed"] },
  checklist: [String],
  documentsReady: [String],
  sellerConfirmedAt: Date,
  sellerConfirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
};

export const actorRefSchema = {
  actorType: { type: String, enum: ["admin", "customer", "system"] },
  actorId: { type: mongoose.Schema.Types.ObjectId }
};

export const attachmentRefSchema = {
  documentId: { type: mongoose.Schema.Types.ObjectId, ref: "Document" },
  fileName: String,
  mimeType: String,
  sizeBytes: Number
};

export const normalizeKey = (value) => {
  if (value == null) return undefined;
  return String(value).trim().toLowerCase().replace(/\s+/g, " ");
};

/**
 * Apply environment-aware strict mode and schemaVersion defaults.
 * Production keeps silent discard (strict:true) with undeclared-path warnings.
 * Development/test throw on undeclared writes.
 */
export const applySchemaDefaults = (schema, { schemaVersion = CURRENT_SCHEMA_VERSION } = {}) => {
  if (!schema.path("schemaVersion")) {
    schema.add({ schemaVersion: { type: Number, default: schemaVersion, required: true } });
  }

  const strictMode = env.NODE_ENV === "production" ? true : "throw";
  schema.set("strict", strictMode);

  if (env.NODE_ENV === "production") {
    const warnUndeclared = function warnUndeclared(next) {
      const update = this.getUpdate?.() || {};
      const payload = { ...update.$set, ...update.$setOnInsert, ...update };
      const paths = Object.keys(payload).filter((key) => !key.startsWith("$"));
      const undeclared = paths.filter((pathName) => !this.schema?.path(pathName.split(".")[0]));
      if (undeclared.length) {
        logger.warn({ message: "Undeclared schema paths in update", paths: undeclared, model: this.model?.modelName });
      }
      next();
    };
    schema.pre("findOneAndUpdate", warnUndeclared);
  }

  // Mongoose 9 no longer passes `next` to middleware; sync hooks complete on return.
  schema.pre("save", function stampSchemaVersion() {
    if (this.schemaVersion == null) this.schemaVersion = schemaVersion;
  });
};

export const arrayMax = (max) => ({
  validator(value) {
    return !Array.isArray(value) || value.length <= max;
  },
  message: `Array exceeds maximum length of ${max}`
});

/**
 * GeoJSON Point that does NOT materialise `{ type: "Point", coordinates: [] }` on documents that have no
 * coordinates. Use this for fields backed by a 2dsphere index (an empty coordinates array is invalid geo data).
 */
export const optionalGeoPointSchema = {
  type: { type: String, enum: ["Point"] },
  coordinates: {
    type: [Number],
    default: undefined,
    validate: geoPointSchema.coordinates.validate
  }
};

/**
 * Keep derived fields (isOpen, slotActive, reservesProperty, ...) consistent when a watched field is changed through
 * an update query (findOneAndUpdate/updateOne/updateMany), which bypasses document pre-validate hooks.
 *
 * `derive(value)` receives the new value of `watchField` and returns an object of `{ path: value }` entries. Entries
 * the caller already set explicitly in the same update are never overwritten.
 */
export const syncDerivedOnUpdate = (schema, watchField, derive) => {
  const hook = function syncDerived() {
    const update = this.getUpdate?.();
    if (!update || Array.isArray(update)) return;
    const $set = update.$set || {};
    const value = watchField in $set ? $set[watchField] : update[watchField];
    if (value === undefined) return;
    const derived = derive(value) || {};
    const additions = {};
    for (const [path, derivedValue] of Object.entries(derived)) {
      if (!(path in $set) && !(path in update)) additions[path] = derivedValue;
    }
    if (Object.keys(additions).length) update.$set = { ...$set, ...additions };
  };
  schema.pre("findOneAndUpdate", hook);
  schema.pre("updateOne", hook);
  schema.pre("updateMany", hook);
};

/**
 * Snapshot sub-schema that keeps unknown keys (strict:false). Use where a field used to be `Mixed` and clients may
 * still send extra display keys (e.g. `coverImage`), so strict:"throw" in development does not reject them.
 */
export const snapshotSubSchema = (definition) => new mongoose.Schema(definition, { _id: false, strict: false });
