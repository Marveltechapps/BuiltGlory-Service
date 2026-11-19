import mongoose from "mongoose";
import { applySchemaDefaults } from "../../database/schemaCommon.js";

export const collectionName = "adminSettings";

export const schemaDefinition = {
  key: { type: String, required: true, unique: true, index: true },
  organization: {
    name: { type: String, trim: true },
    tagline: { type: String, trim: true },
    email: { type: String, trim: true },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    pincode: { type: String, trim: true }
  },
  app: {
    maintenance: { type: Boolean, default: false },
    registration: { type: Boolean, default: true },
    kycRequired: { type: Boolean, default: true },
    showPrices: { type: Boolean, default: true },
    virtualTours: { type: Boolean, default: true },
    stagePayment: { type: Boolean, default: true },
    interior: { type: Boolean, default: true },
    // PENDING PRODUCT DECISION: app.maintenance stays a Boolean (the architecture target is an object). The
    // message / ETA live in maintenanceInfo until the /app/config contract is migrated.
    maintenanceInfo: {
      message: { type: String, trim: true },
      expectedBackAt: Date
    },
    // Replaces the CMS record `app-force-update-config`; read by /app/config on every splash.
    forceUpdate: {
      enabled: { type: Boolean, default: false },
      minVersion: { type: String, trim: true },
      latestVersion: { type: String, trim: true },
      message: { type: String, trim: true },
      storeUrls: {
        android: { type: String, trim: true },
        ios: { type: String, trim: true }
      }
    }
  },
  // Marketing stats shown on the web app ("18 Cities", "4.8*").
  stats: {
    cities: { type: Number, min: 0 },
    appRating: { type: Number, min: 0, max: 5 }
  },
  sla: {
    interiorHours: { type: Number, min: 1, max: 168 },
    stagePaymentHours: { type: Number, min: 1, max: 168 },
    enquiryHours: { type: Number, min: 1, max: 168 },
    autoEscalate: { type: Boolean, default: true },
    escalateToAdminId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    escalateToName: { type: String, trim: true }
  },
  alerts: {
    triggers: { type: mongoose.Schema.Types.Mixed, default: {} },
    email: { type: String, trim: true },
    whatsapp: { type: String, trim: true }
  },
  notifications: {
    contact: {
      phone: { type: String, trim: true },
      email: { type: String, trim: true },
      ccEmail: { type: String, trim: true }
    },
    email: { type: mongoose.Schema.Types.Mixed, default: {} },
    whatsapp: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  display: {
    timezone: { type: String, trim: true },
    dateFormat: { type: String, trim: true },
    currencyFormat: { type: String, enum: ["indian", "international"], default: "indian" }
  },
  payment: {
    tokenAmount: { type: Number, min: 0, default: 250000 },
    escrow: {
      accountHolder: { type: String, trim: true },
      bankName: { type: String, trim: true },
      accountNumber: { type: String, trim: true },
      ifsc: { type: String, trim: true },
      branch: { type: String, trim: true },
      upiId: { type: String, trim: true },
      chequePayee: { type: String, trim: true },
      chequeInstructions: [String]
    }
  },
  masterData: { type: mongoose.Schema.Types.Mixed, default: {} },
  tools: {
    boostPlans: [{
      id: String,
      name: { type: String, trim: true },
      priceLabel: { type: String, trim: true },
      description: { type: String, trim: true },
      benefits: [String],
      active: { type: Boolean, default: true }
    }],
    interiorPackages: [{
      id: String,
      name: { type: String, trim: true },
      priceRange: { type: String, trim: true },
      timeline: { type: String, trim: true },
      active: { type: Boolean, default: true }
    }],
    coupons: [{
      id: String,
      code: { type: String, trim: true },
      discount: { type: String, trim: true },
      type: { type: String, enum: ["% discount", "Flat discount"] },
      appliesTo: { type: String, trim: true },
      uses: { type: String, trim: true },
      expiry: { type: String, trim: true },
      active: { type: Boolean, default: true }
    }]
  },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
  /** Optimistic concurrency token (PATCH sends it; update filters on it and increments). Not enforced yet. */
  version: { type: Number, default: 0, min: 0 }
};

export const configureSchema = (schema) => {
  // The collection holds a single document, so this index is redundant ([D] in the architecture), but it is kept
  // declared so syncIndexes does not drop it prematurely.
  schema.index({ updatedAt: -1 }); // [D] retain until 7-day post-deploy monitor; then drop
  // `key` stays "dashboard"/"global" as-is (PENDING PRODUCT DECISION: do not rename dashboard -> global yet).
  applySchemaDefaults(schema);
};
