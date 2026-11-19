import mongoose from "mongoose";
import { BOOST_ORDER_STATUSES } from "../../constants/enums.js";
import { applySchemaDefaults, arrayMax, moneyField } from "../../database/schemaCommon.js";

/** boostOrders (DATABASE_ARCHITECTURE.md §12.7). referenceId prefix: BG-BST (makeReferenceId("boostOrders")). */
export const collectionName = "boostOrders";

export const schemaDefinition = {
  referenceId: { type: String, required: true, unique: true, index: true },
  propertyId: { type: mongoose.Schema.Types.ObjectId, ref: "Property", required: true },
  sellRequestId: { type: mongoose.Schema.Types.ObjectId, ref: "SellRequest" },
  /** adminSettings.tools.boostPlans[].id */
  planId: { type: String, required: true, trim: true, maxlength: 100 },
  planSnapshot: {
    _id: false,
    name: { type: String, required: true, trim: true, maxlength: 200 },
    priceLabel: { type: String, trim: true, maxlength: 100 },
    benefits: { type: [String], default: [], validate: arrayMax(50) }
  },
  amount: moneyField(),
  paymentId: { type: mongoose.Schema.Types.ObjectId, ref: "Payment" },
  status: { type: String, enum: BOOST_ORDER_STATUSES, required: true, default: "scheduled" },
  startsAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" }
};

export const configureSchema = (schema) => {
  applySchemaDefaults(schema);
  schema.path("expiresAt").validate(function expiresAfterStart(value) {
    return !value || !this.startsAt || value > this.startsAt;
  }, "expiresAt must be after startsAt");
  schema.index({ propertyId: 1, status: 1 });
  // Boost expiry job.
  schema.index({ status: 1, expiresAt: 1 });
};
