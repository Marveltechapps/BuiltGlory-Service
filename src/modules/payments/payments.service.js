import { createService } from "../../services/service.factory.js";
import { repository } from "./payments.repository.js";
import { SalesDeal } from "../salesDeals/salesDeals.model.js";
import { Property } from "../properties/properties.model.js";
import { Document } from "../documents/documents.model.js";
import { Payment } from "./payments.model.js";
import { makeReferenceId } from "../../utils/id.js";
import { service as adminSettingsService } from "../adminSettings/adminSettings.service.js";
import { conflict, domainError, unauthorized } from "./payments.error.js";
import { writeAuditLog } from "../../services/audit.service.js";
import { withTransaction } from "../../database/transactions.js";
import { notifyLifecycle } from "../../services/service.factory.js";

const baseService = createService({ collection: "payments", repository, workflowField: "status", workflowMap: "paymentStatus", ownerField: "userId" });
const confirmableStatuses = new Set(["created", "pending"]);
const manualMethods = new Set(["bank", "upi", "cheque", "cash"]);
const dealMethodMap = { bank: "neft", upi: "upi", cheque: "cheque", cash: "cash", neft: "neft" };

const snapshotTokenPayment = (payment, extra = {}) => ({
  amount: payment.amount,
  method: dealMethodMap[payment.method] || payment.method || "cash",
  paymentDate: new Date().toISOString().slice(0, 10),
  reference: payment.transactionReference || extra.reference || null,
  proofUrl: payment.proofUrl || extra.proofUrl || null,
  proofDocumentId: payment.proofDocumentId || extra.proofDocumentId || null,
  notes: extra.notes || payment.verificationNotes || payment.notes || "",
  paymentId: String(payment._id),
  verifiedBy: extra.verifiedBy || payment.verifiedBy || null,
  verifiedAt: extra.verifiedAt || payment.verifiedAt || new Date()
});

const couponUseLimit = (uses) => {
  const text = String(uses || "");
  const slash = text.match(/(\d+)\s*\/\s*(\d+)/);
  if (slash) return Number(slash[2]);
  const only = text.match(/(\d+)/);
  return only ? Number(only[1]) : 0;
};

/** Applies a stored coupon only when it explicitly targets token payments and its numbers parse. */
const quoteTokenCoupon = async ({ settings, code, userId, tokenAmount }) => {
  const normalized = String(code || "").trim().toUpperCase();
  const coupon = (settings.tools?.coupons || []).find((item) => String(item.code || "").trim().toUpperCase() === normalized);
  if (!coupon || coupon.active === false) throw domainError("Coupon is not active.");
  if (!/token/i.test(String(coupon.appliesTo || ""))) throw domainError("This coupon does not apply to token payments.");
  const expiry = Date.parse(String(coupon.expiry || ""));
  if (!Number.isFinite(expiry)) throw domainError("Coupon expiry is not a valid date.");
  if (expiry < Date.now()) throw domainError("Coupon has expired.");
  const limit = couponUseLimit(coupon.uses);
  if (!(limit > 0)) throw domainError("Coupon use limit is not set.");
  const raw = String(coupon.discount || "").replace(/[₹,\s]/g, "").replace(/%$/, "");
  const value = Number(raw);
  if (!(value > 0)) throw domainError("Coupon discount is not a valid amount.");
  let amount = 0;
  if (coupon.type === "% discount") {
    if (value >= 100) throw domainError("Coupon discount must leave a payable token.");
    amount = Math.round((tokenAmount * (100 - value)) / 100);
  } else if (coupon.type === "Flat discount") {
    amount = tokenAmount - value;
  } else {
    throw domainError("Coupon type is not supported.");
  }
  if (!(amount > 0) || amount >= tokenAmount) throw domainError("Coupon discount must leave a payable token.");
  const usedFilter = { couponCode: normalized, isDeleted: { $ne: true }, status: { $nin: ["cancelled", "rejected", "failed"] } };
  const used = await Payment.countDocuments(usedFilter);
  if (used >= limit) throw domainError("Coupon has reached its use limit.");
  if (userId && await Payment.findOne({ ...usedFilter, userId })) throw domainError("You have already used this coupon.");
  return { code: normalized, amount };
};

const assertProofDocument = async ({ proofDocumentId, dealId, actor }) => {
  if (!proofDocumentId) return null;
  const doc = await Document.findOne({ _id: proofDocumentId, isDeleted: { $ne: true } });
  if (!doc) throw domainError("Payment proof was not found.");
  const ownerOk =
    (doc.ownerType === "sales_deal" && String(doc.ownerId) === String(dealId)) ||
    (doc.ownerType === "user" && String(doc.ownerId) === String(actor?.id)) ||
    (doc.ownerType === "payment" && String(doc.uploadedBy) === String(actor?.id));
  if (!ownerOk) throw domainError("Payment proof does not belong to this deal.");
  if (doc.purpose !== "payment_proof") throw domainError("Document is not a payment proof.");
  return doc;
};

const markDealTokenPaid = async ({ payment, actor, notes, session }) => {
  const verifiedAt = new Date();
  const sessionOpt = session ? { session } : undefined;

  // Atomically claim the property for this deal. Reject if already reserved/sold (QA-BUG-005).
  if (payment.propertyId) {
    const claimed = await Property.findOneAndUpdate(
      { _id: payment.propertyId, status: "available", isDeleted: { $ne: true } },
      { $set: { status: "reserved", reservedByDealId: payment.dealId } },
      { returnDocument: "after", ...sessionOpt }
    );
    if (!claimed) {
      const existing = await Property.findOne({ _id: payment.propertyId, isDeleted: { $ne: true } }, null, sessionOpt);
      if (existing && existing.status === "reserved" && String(existing.reservedByDealId || "") === String(payment.dealId)) {
        // Idempotent re-verify for the same deal.
      } else {
        throw conflict("Property is already reserved by another buyer.");
      }
    }
  }

  // Only count this payment once even if verify is retried (QA-BUG-006).
  const dealPatch = {
    $inc: { "financials.totalPaid": payment.amount },
    $set: {
      lastActivityAt: verifiedAt,
      reservesProperty: true,
      "financials.tokenPaid": true,
      "financials.tokenAmount": payment.amount,
      "financials.tokenPayment": snapshotTokenPayment(payment, {
        notes,
        verifiedBy: actor?.id,
        verifiedAt
      }),
      "financials.tokenPaymentId": payment._id
    }
  };
  await SalesDeal.findOneAndUpdate(
    { _id: payment.dealId, "financials.tokenPaid": { $ne: true } },
    dealPatch,
    sessionOpt
  );
  return verifiedAt;
};

export const confirmDealPaymentsFromAdmin = async ({ dealId, type, actor, req, notes }) => {
  if (!dealId) return [];
  const filter = { dealId, isDeleted: { $ne: true }, status: { $in: [...confirmableStatuses] } };
  if (type) filter.type = type;
  const pending = await repository.Model.find(filter).sort({ createdAt: -1 });
  const confirmed = [];
  const verifiedAt = new Date();
  for (const payment of pending) {
    if (!confirmableStatuses.has(payment.status)) continue;
    const updated = await baseService.transition(payment._id, "paid", actor || { type: "admin" }, req, {
      paidAt: verifiedAt,
      verifiedBy: actor?.id,
      verifiedAt,
      verificationNotes: notes || "Confirmed by admin after manual verification."
    });
    confirmed.push(updated);
  }
  return confirmed;
};

export const service = {
  ...baseService,
  async create(data, actor) {
    if (!(Number(data.amount) > 0)) throw domainError("Payment amount must be positive.");
    const deal = data.dealId ? await SalesDeal.findById(data.dealId) : null;
    if (deal && String(deal.buyerId) !== String(actor?.id)) throw domainError("Payment deal does not belong to the customer.");
    const type = data.type || "token";
    if (data.method && !manualMethods.has(data.method)) throw domainError("Choose bank, UPI, cheque, or cash.");
    const method = manualMethods.has(data.method) ? data.method : "bank";
    const openPayment = await repository.findOne({ dealId: data.dealId, userId: actor?.id, type, status: { $in: ["created", "pending"] } });
    if (openPayment) return openPayment;
    const paidPayment = await repository.findOne({ dealId: data.dealId, userId: actor?.id, type, status: "paid" });
    if (paidPayment) return paidPayment;
    let idempotencyKey = data.idempotencyKey;
    if (idempotencyKey) {
      const existing = await repository.findOne({ idempotencyKey, userId: actor?.id });
      if (existing && ["created", "pending", "paid"].includes(existing.status)) return existing;
      if (existing && ["failed", "cancelled", "rejected"].includes(existing.status)) {
        idempotencyKey = `${idempotencyKey}-retry-${Date.now()}`;
      }
    }
    let amount = Number(data.amount);
    let couponCode;
    if (type === "token") {
      const settings = await adminSettingsService.get();
      const expectedAmount = Number(settings.payment?.tokenAmount ?? 250000);
      if (data.couponCode) {
        const quote = await quoteTokenCoupon({ settings, code: data.couponCode, userId: actor?.id, tokenAmount: expectedAmount });
        if (expectedAmount > 0 && amount !== quote.amount) throw domainError("Token payment amount must match the coupon price.");
        amount = quote.amount;
        couponCode = quote.code;
      } else {
        if (expectedAmount > 0 && amount !== expectedAmount) throw domainError("Token payment amount must match configured token amount.");
        amount = expectedAmount;
      }
    }
    const proof = await assertProofDocument({ proofDocumentId: data.proofDocumentId, dealId: data.dealId, actor });
    const payment = await baseService.create({
      ...data,
      amount,
      userId: actor?.id,
      propertyId: data.propertyId || deal?.propertyId,
      type,
      method,
      gateway: "escrow",
      status: "created",
      transactionReference: String(data.transactionReference || "").trim(),
      proofDocumentId: proof?._id || (data.proofDocumentId ? data.proofDocumentId : undefined),
      proofUrl: proof?.url || "",
      notes: String(data.notes || "").trim(),
      submittedAt: new Date(),
      idempotencyKey,
      ...(couponCode ? { couponCode } : {})
    }, actor);
    return repository.update(payment._id, { status: "pending" });
  },
  async cancel(id, actor, req) {
    const payment = await repository.findById(id);
    if (String(payment.userId) !== String(actor?.id)) throw domainError("You cannot cancel this payment.");
    if (!confirmableStatuses.has(payment.status)) throw domainError("Only pending payments can be cancelled.");
    return baseService.transition(id, "cancelled", actor, req, { failureReason: "Cancelled by customer." });
  },
  async verify(id, { decision, notes } = {}, actor, req) {
    if (actor?.type !== "admin") throw unauthorized("Admin access is required to verify payments.");
    const payment = await repository.findById(id);
    if (!confirmableStatuses.has(payment.status)) throw domainError("Only pending payments can be verified.");
    const verificationNotes = String(notes || "").trim();
    if (decision === "rejected") {
      if (!verificationNotes) throw domainError("A rejection reason is required.");
      return baseService.transition(id, "rejected", actor, req, {
        verificationNotes,
        verifiedBy: actor.id,
        verifiedAt: new Date(),
        rejectedAt: new Date(),
        failureReason: verificationNotes
      });
    }
    if (decision !== "paid") throw domainError("Decision must be paid or rejected.");
    const verifiedAt = new Date();
    const notesText = verificationNotes || "Verified by admin after manual confirmation.";
    // One transaction: CAS claim of pending→paid + atomic property reserve (QA-BUG-005 / QA-BUG-006).
    // Do not use a plain transition-then-side-effect path: MongoDB transaction retries would
    // re-run markDealTokenPaid after status is already paid and inflate totalPaid.
    return withTransaction(async (session) => {
      const sessionOpt = session ? { session } : undefined;
      const updated = await repository.Model.findOneAndUpdate(
        { _id: id, status: { $in: [...confirmableStatuses] }, isDeleted: { $ne: true } },
        {
          $set: {
            status: "paid",
            paidAt: verifiedAt,
            verifiedBy: actor.id,
            verifiedAt,
            verificationNotes: notesText
          }
        },
        { returnDocument: "after", runValidators: true, ...sessionOpt }
      );
      if (!updated) throw conflict("Payment was already verified or is not pending.");
      await writeAuditLog({
        actor,
        action: "payments.status_changed",
        resourceType: "payments",
        resourceId: id,
        before: { status: payment.status },
        after: updated.toObject?.() || updated,
        req
      }, sessionOpt);
      await notifyLifecycle({ collection: "payments", action: "transition", doc: updated, to: "paid" });
      if (updated.dealId) {
        await markDealTokenPaid({
          payment: updated,
          actor,
          notes: notesText,
          session
        });
      }
      return updated;
    });
  },
  async recordAdminOffline({ dealId, amount, method, reference, proofUrl, proofDocumentId, notes }, actor, req) {
    if (actor?.type !== "admin") throw unauthorized("Admin access is required to record offline payments.");
    const deal = await SalesDeal.findById(dealId);
    if (!deal) throw domainError("Sales deal was not found.");
    const existingPaid = await repository.findOne({ dealId, type: "token", status: "paid" });
    if (existingPaid) return existingPaid;
    const verifiedAt = new Date();
    const paymentMethod = manualMethods.has(method) || method === "neft" ? (method === "neft" ? "bank" : method) : "cash";
    const payment = await baseService.create({
      userId: deal.buyerId,
      dealId: deal._id,
      propertyId: deal.propertyId,
      type: "token",
      amount: Number(amount) || Number(deal.financials?.tokenAmount) || 0,
      currency: "INR",
      method: paymentMethod,
      gateway: "escrow",
      status: "paid",
      transactionReference: String(reference || "").trim(),
      proofDocumentId: proofDocumentId || undefined,
      proofUrl: proofUrl || "",
      notes: String(notes || "").trim(),
      submittedAt: verifiedAt,
      paidAt: verifiedAt,
      verifiedBy: actor.id,
      verifiedAt,
      verificationNotes: String(notes || "").trim() || "Recorded by admin for in-person / offline payment."
    }, actor);
    await writeAuditLog({
      actor,
      action: "payments.status_changed",
      resourceType: "payments",
      resourceId: payment._id,
      before: { status: "created" },
      after: payment.toObject?.() || payment,
      req
    });
    return payment;
  },
  /**
   * Records one outbound refund for a paid customer payment.
   * The original payment becomes `refunded` only together with a refund row that carries
   * the admin's transfer reference. A second call returns that same row.
   */
  async recordVerifiedRefund(id, { transactionReference, notes } = {}, actor, req) {
    if (actor?.type !== "admin") throw unauthorized("Admin access is required to record a refund.");
    const reference = String(transactionReference || "").trim();
    if (reference.length < 4) throw domainError("A verified refund reference is required. The payment is not marked refunded without it.");
    const original = await repository.findById(id);
    if (original.type === "refund") throw domainError("Record the refund against the original payment.");
    if (!["token", "full", "stage"].includes(original.type)) throw domainError("This payment type cannot be refunded here.");
    try {
      return await withTransaction(async (session) => {
        const existing = await Payment.findOne({ refundOfPaymentId: original._id, type: "refund", isDeleted: { $ne: true } }).session(session);
        if (existing?.status === "refunded") return existing;
        if (original.status !== "paid") throw domainError("Only a paid payment can be refunded.");
        await baseService.transition(original._id, "refunded", actor, req, {
          session,
          verificationNotes: String(notes || "").trim() || "Refund recorded against a verified transfer reference."
        });
        const [refund] = await Payment.create([{
          referenceId: makeReferenceId("payments"),
          userId: original.userId,
          direction: "outbound",
          dealId: original.dealId,
          propertyId: original.propertyId,
          refundOfPaymentId: original._id,
          type: "refund",
          amount: original.amount,
          currency: original.currency || "INR",
          status: "refunded",
          isOpen: false,
          method: original.method || "bank",
          gateway: "escrow",
          transactionReference: reference,
          notes: String(notes || "").trim(),
          verifiedBy: actor.id,
          verifiedAt: new Date(),
          paidAt: new Date(),
          submittedAt: new Date()
        }], { session });
        await writeAuditLog({
          actor,
          action: "payments.refund_recorded",
          resourceType: "payments",
          resourceId: refund._id,
          before: { status: "paid", paymentId: String(original._id) },
          after: { status: "refunded", transactionReference: reference },
          req
        }, session ? { session } : undefined);
        return refund;
      });
    } catch (error) {
      const existing = await Payment.findOne({ refundOfPaymentId: original._id, type: "refund", status: "refunded", isDeleted: { $ne: true } });
      if (existing) return existing;
      throw error;
    }
  }
};
