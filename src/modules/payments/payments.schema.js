import mongoose from "mongoose";
import {
  PAYMENT_STATUSES,
  PAYMENT_TYPES,
  PAYMENT_METHODS,
  PAYMENT_DIRECTIONS,
  PAYMENT_GATEWAYS,
  ACTOR_TYPES
} from "../../constants/enums.js";
import {
  applySchemaDefaults,
  arrayMax,
  positiveMoneyField,
  syncDerivedOnUpdate
} from "../../database/schemaCommon.js";

const { ObjectId, Mixed } = mongoose.Schema.Types;

export const collectionName = "payments";

/** Payment statuses that count as "open" (awaiting verification / completion). */
export const OPEN_PAYMENT_STATUSES = ["created", "pending"];
/** Payment types that move money out of BuiltGlory (everything else is inbound). */
export const OUTBOUND_PAYMENT_TYPES = ["seller_payout", "refund"];

const statusHistorySchema = new mongoose.Schema({
  from: String,
  to: String,
  at: { type: Date, default: Date.now },
  actorType: { type: String, enum: [...ACTOR_TYPES, null] },
  actorId: ObjectId,
  reason: String
}, { _id: false });

export const schemaDefinition = {
  referenceId: { type: String, required: true, unique: true, index: true },
  /** Payer (buyer) or payee (seller). */
  userId: { type: ObjectId, ref: "User", required: true },
  /** seller_payout / refund => outbound. Defaulted from `type` in pre-validate when not supplied. */
  direction: { type: String, enum: PAYMENT_DIRECTIONS },
  dealId: { type: ObjectId, ref: "SalesDeal" },
  acquisitionId: { type: ObjectId, ref: "Acquisition" },
  sellRequestId: { type: ObjectId, ref: "SellRequest" },
  propertyId: { type: ObjectId, ref: "Property" },
  /** Matches salesDeals Milestone.id (e.g. "MS-2") for stage payments. */
  milestoneId: { type: String, trim: true },
  refundOfPaymentId: { type: ObjectId, ref: "Payment" },

  type: { type: String, enum: PAYMENT_TYPES, required: true },
  /** Integer INR rupees, > 0. */
  amount: positiveMoneyField({ required: true }),
  /** Razorpay amount in paise (amount x 100). */
  gatewayAmountPaise: { type: Number, min: 0 },
  currency: { type: String, default: "INR", uppercase: true, trim: true, minlength: 3, maxlength: 3 },

  status: { type: String, enum: PAYMENT_STATUSES, default: "created" },
  /** Derived: status in { created, pending }. Backs the "one open buyer payment" partial unique index. */
  isOpen: { type: Boolean, default: true },
  statusHistory: { type: [statusHistorySchema], validate: arrayMax(20) },

  method: { type: String, enum: PAYMENT_METHODS, default: "bank" },
  gateway: { type: String, enum: PAYMENT_GATEWAYS, default: "escrow" },
  gatewayOrderId: { type: String, sparse: true, unique: true },
  gatewayPaymentId: { type: String, sparse: true, unique: true },
  gatewaySignature: { type: String, select: false },
  providerEventId: { type: String, sparse: true, unique: true },
  providerEventAt: Date,
  /** Unique per user (see configureSchema); a legacy global sparse unique index is also kept ([D]) for now. */
  idempotencyKey: { type: String },

  /** UTR / UPI ref / cheque number. */
  transactionReference: { type: String, default: "", maxlength: 100 },
  /** Set only when a token coupon applied. Empty for a full-price token. */
  couponCode: { type: String, trim: true, uppercase: true, maxlength: 40 },
  proofDocumentId: { type: ObjectId, ref: "Document" },
  /** @deprecated use proofDocumentId. */
  proofUrl: String,
  notes: { type: String, default: "", maxlength: 1000 },
  submittedAt: Date,
  verifiedBy: { type: ObjectId, ref: "Admin" },
  verifiedAt: Date,
  verificationNotes: { type: String, default: "", maxlength: 1000 },
  rejectedAt: Date,
  rejectionReason: String,
  paidAt: Date,
  failedAt: Date,
  failureReason: String,
  providerResponse: { type: Mixed, select: false }
};

export const configureSchema = (schema) => {
  schema.index({ userId: 1, createdAt: -1 }); // GET /me/payments
  schema.index({ dealId: 1, status: 1 }); // deal confirm, open payment check
  // [C] Idempotency is per user, and only for documents that actually carry a key.
  schema.index(
    { userId: 1, idempotencyKey: 1 },
    { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } }
  );
  // [D] Legacy global idempotency uniqueness, kept alongside the per-user index above.
  schema.index({ idempotencyKey: 1 }, { unique: true, sparse: true }); // [D] retain until 7-day post-deploy monitor; then drop
  schema.index({ status: 1, createdAt: 1 }); // [N] admin verification queue, oldest first
  schema.index({ status: 1, paidAt: -1, type: 1 }); // [N] revenue by month and type
  schema.index({ acquisitionId: 1, type: 1 }, { sparse: true }); // [N] seller payout schedule
  schema.index(
    { refundOfPaymentId: 1 },
    {
      unique: true,
      partialFilterExpression: { type: "refund", isDeleted: false, refundOfPaymentId: { $type: "objectId" } },
      name: "one_refund_per_payment"
    }
  );
  // [N] At most one open inbound buyer payment per deal, type, milestone and user.
  schema.index(
    { dealId: 1, type: 1, milestoneId: 1, userId: 1 },
    {
      unique: true,
      partialFilterExpression: { isOpen: true, direction: "inbound", dealId: { $type: "objectId" } },
      name: "open_payment_unique_deal_type_milestone"
    }
  );

  schema.pre("validate", function derivePaymentFields() {
    // Auto-fill only; these hooks never reject legacy writes.
    if (!this.direction) this.direction = OUTBOUND_PAYMENT_TYPES.includes(this.type) ? "outbound" : "inbound";
    if (this.status === "paid" && !this.paidAt && (this.isNew || this.isModified("status"))) this.paidAt = new Date();
    if (this.isNew || this.isModified("status")) this.isOpen = OPEN_PAYMENT_STATUSES.includes(this.status);
    if (this.amount != null && this.gatewayAmountPaise == null && this.gateway === "razorpay") {
      this.gatewayAmountPaise = Math.round(Number(this.amount) * 100);
    }
  });

  // Status transitions run through findOneAndUpdate (baseService.transition); keep isOpen in step.
  // Also stamps paidAt when a status update to "paid" does not carry one (never overwrites an explicit paidAt).
  syncDerivedOnUpdate(schema, "status", (status) => ({
    isOpen: OPEN_PAYMENT_STATUSES.includes(status),
    ...(status === "paid" ? { paidAt: new Date() } : {})
  }));

  applySchemaDefaults(schema);
};
