import { createController } from "../../utils/controller.factory.js";
import { service } from "./salesDeals.service.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import * as customerDealsModule from "./salesDeals.customerDeals.js";
export const controller = {
  ...createController(service, { idParam: "dealId" }),
  getMeDeals: asyncHandler(async (req, res) => {
    const result = await customerDealsModule.listCustomerDeals(req.actor, req.query);
    res.json({ data: result.data, meta: { ...result.meta, requestId: res.locals.requestId } });
  }),
  getAdminSalesDealsRecommendations: asyncHandler(async (req, res) => {
    const data = await service.recommendations(req.params.dealId, req.query || {});
    res.json({ data, meta: { requestId: res.locals.requestId } });
  }),
  updateAdminSalesDealsOffer: asyncHandler(async (req, res) => {
    const patch = { $set: { lastActivityAt: new Date() } };
    if (req.body.offeredPrice !== undefined) patch.$set["financials.offeredPrice"] = req.body.offeredPrice;
    if (req.body.agreedPrice !== undefined) patch.$set["financials.agreedPrice"] = req.body.agreedPrice;
    const data = await service.update(req.params.dealId, patch, req.actor, req);
    res.json({ data, meta: { requestId: res.locals.requestId } });
  }),
  updateAdminSalesDealsTokenPayment: asyncHandler(async (req, res) => {
    const { SalesDeal } = await import("./salesDeals.model.js");
    const existing = await SalesDeal.findById(req.params.dealId);
    const patch = { $set: { lastActivityAt: new Date() } };
    if (req.body.tokenAmount !== undefined) patch.$set["financials.tokenAmount"] = req.body.tokenAmount;
    if (req.body.tokenPaid !== undefined) patch.$set["financials.tokenPaid"] = req.body.tokenPaid;
    if (req.body.tokenPayment !== undefined) patch.$set["financials.tokenPayment"] = req.body.tokenPayment;
    const wasPaid = Boolean(existing?.financials?.tokenPaid);
    const nextPaid = req.body.tokenPaid !== undefined ? Boolean(req.body.tokenPaid) : wasPaid;
    const nextAmount = Number(req.body.tokenAmount ?? req.body.tokenPayment?.amount ?? existing?.financials?.tokenAmount ?? 0);
    const currentPaid = Number(existing?.financials?.totalPaid ?? 0);
    if (!wasPaid && nextPaid && nextAmount > 0) patch.$set["financials.totalPaid"] = currentPaid + nextAmount;
    if (wasPaid && req.body.tokenPaid === false) {
      const previousAmount = Number(existing?.financials?.tokenAmount ?? 0);
      patch.$set["financials.totalPaid"] = Math.max(0, currentPaid - previousAmount);
    }
    const data = await service.update(req.params.dealId, patch, req.actor, req);
    if (req.body.tokenPaid) {
      const { SalesDeal } = await import("./salesDeals.model.js");
      const { Property } = await import("../properties/properties.model.js");
      const paymentModule = await import("../payments/payments.service.js");
      const deal = await SalesDeal.findById(req.params.dealId);
      await Property.findByIdAndUpdate(deal.propertyId, { status: "reserved" });
      const confirmed = await paymentModule.confirmDealPaymentsFromAdmin({
        dealId: req.params.dealId,
        type: "token",
        actor: req.actor,
        req,
        notes: req.body.tokenPayment?.notes
      });
      if (!confirmed.length) {
        const recorded = req.body.tokenPayment || {};
        await paymentModule.service.recordAdminOffline({
          dealId: req.params.dealId,
          amount: req.body.tokenAmount ?? recorded.amount,
          method: recorded.method,
          reference: recorded.reference,
          proofUrl: recorded.proofUrl,
          proofDocumentId: recorded.proofDocumentId,
          notes: recorded.notes
        }, req.actor, req);
      }
    }
    res.json({ data, meta: { requestId: res.locals.requestId } });
  }),
  updateAdminSalesDealsPaymentPlan: asyncHandler(async (req, res) => {
    const patch = { $set: { lastActivityAt: new Date() } };
    if (req.body.paymentType !== undefined) patch.$set["financials.paymentType"] = req.body.paymentType;
    if (req.body.totalPaid !== undefined) patch.$set["financials.totalPaid"] = req.body.totalPaid;
    if (req.body.fullPayment !== undefined) patch.$set["financials.fullPayment"] = req.body.fullPayment;
    if (req.body.stagePayment !== undefined) patch.$set["financials.stagePayment"] = req.body.stagePayment;
    if (req.body.interiorDesign !== undefined) patch.$set["financials.interiorDesign"] = req.body.interiorDesign;
    const milestones = req.body.stagePayment?.milestones;
    if (Array.isArray(milestones) && milestones.length) {
      const { SalesDeal } = await import("./salesDeals.model.js");
      const deal = await SalesDeal.findById(req.params.dealId);
      const tokenPaid = req.body.tokenPaid ?? deal?.financials?.tokenPaid;
      const tokenAmount = Number(req.body.tokenAmount ?? deal?.financials?.tokenAmount ?? 0);
      const milestonePaid = milestones.filter((item) => item?.status === "paid").reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
      patch.$set["financials.totalPaid"] = (tokenPaid ? tokenAmount : 0) + milestonePaid;
    }
    const data = await service.update(req.params.dealId, patch, req.actor, req);
    res.json({ data, meta: { requestId: res.locals.requestId } });
  }),
  updateAdminSalesDealsDocumentation: asyncHandler(async (req, res) => {
    const documentation = req.body?.documentation && typeof req.body.documentation === "object" ? req.body.documentation : (req.body || {});
    const data = await service.update(req.params.dealId, { $set: { documentation, lastActivityAt: new Date() } }, req.actor, req);
    res.json({ data, meta: { requestId: res.locals.requestId } });
  }),
  updateAdminSalesDealsClose: asyncHandler(async (req, res) => {
    const data = await service.transition(req.params.dealId, "closed", req.actor, req, req.body || {});
    res.json({ data, meta: { requestId: res.locals.requestId } });
  }),
  updateAdminSalesDealsLost: asyncHandler(async (req, res) => {
    const data = await service.transition(req.params.dealId, "lost", req.actor, req, req.body || {});
    res.json({ data, meta: { requestId: res.locals.requestId } });
  })
};
