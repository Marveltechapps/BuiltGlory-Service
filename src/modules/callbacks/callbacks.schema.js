import mongoose from "mongoose";
import {
  CALLBACK_STATUSES,
  CALLBACK_SOURCES,
  CALLBACK_CATEGORIES,
  CALL_OUTCOMES
} from "../../constants/enums.js";
import { applySchemaDefaults, arrayMax, userSnapshotSchema } from "../../database/schemaCommon.js";

const { ObjectId } = mongoose.Schema.Types;

export const collectionName = "callbacks";

export const schemaDefinition = {
  referenceId: { type: String, required: true, unique: true, index: true },
  userId: { type: ObjectId, ref: "User", required: true },
  /** Dashboard reads it. */
  userSnapshot: { ...userSnapshotSchema },
  userType: { type: String, enum: ["buyer", "seller", "nri"] },
  source: { type: String, enum: CALLBACK_SOURCES, default: "help_support", required: true },
  // Joi allows up to 120 chars today, so the cap here is 120 (architecture target is 60).
  sourceScreen: { type: String, maxlength: 120 },
  category: { type: String, enum: CALLBACK_CATEGORIES, default: "general" },
  propertyId: { type: ObjectId, ref: "Property" },
  propertySnapshot: { title: String },
  reason: { type: String, maxlength: 1000 },
  preferredTime: Date,
  bestTimePreference: { type: String, enum: ["morning", "afternoon", "evening"] },
  /** The number to call, captured at request time. */
  phone: String,
  status: { type: String, enum: CALLBACK_STATUSES, default: "pending" },
  slaDeadline: { type: Date, required: true },
  assignedTo: { type: ObjectId, ref: "Admin" },
  attemptsCount: { type: Number, default: 0, min: 0 },
  attempts: {
    type: [{
      outcome: { type: String, enum: CALL_OUTCOMES },
      notes: String,
      attemptedAt: Date,
      attemptedBy: { type: ObjectId, ref: "Admin" }
    }],
    validate: arrayMax(20)
  },
  resolutionNotes: String,
  resolvedAt: Date
};

export const configureSchema = (schema) => {
  schema.index({ status: 1, slaDeadline: 1 });
  schema.index({ assignedTo: 1, status: 1 });
  schema.index({ userId: 1, createdAt: -1 });

  applySchemaDefaults(schema);
};
