import { createController } from "../../utils/controller.factory.js";
import { service } from "./sellRequests.service.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { publishSellerActivity } from "../../realtime/chatSocket.js";
export const controller = {
  ...createController(service, { idParam: "sellRequestId" }),
  createSellRequestsDrafts: asyncHandler(async (req, res) => {
    const data = await service.create({ ...req.body, status: "draft", isDraft: true }, req.actor);
    res.status(201).json({ data, meta: { requestId: res.locals.requestId } });
  }),
  getMeSellRequestsActivity: asyncHandler(async (req, res) => {
    const data = await service.sellerActivity(req.params.sellRequestId, req.actor);
    res.json({ data, meta: { requestId: res.locals.requestId } });
  }),
  putMeSellRequestsAvailability: asyncHandler(async (req, res) => {
    const data = await service.setSellerAvailability(req.params.sellRequestId, req.body, req.actor);
    res.json({ data, meta: { requestId: res.locals.requestId } });
  }),
  createMeSellRequestsWithdraw: asyncHandler(async (req, res) => {
    const data = await service.withdraw(req.params.sellRequestId, req.actor, req);
    res.json({ data, meta: { requestId: res.locals.requestId } });
  }),
  createMeSellRequestsSubmit: asyncHandler(async (req, res) => {
    const { isDraft, status, draftStep, draftSavedAt, ...safeBody } = req.body || {};
    const data = await service.transition(req.params.sellRequestId, "new", req.actor, req, safeBody);
    res.json({ data, meta: { requestId: res.locals.requestId } });
  }),
  createMeSellRequestsOfferDecision: asyncHandler(async (req, res) => {
    const data = await service.sellerOfferDecision(req.params.sellRequestId, req.body, req.actor, req);
    res.json({ data, meta: { requestId: res.locals.requestId } });
  }),
  createMeSellRequestsMessages: asyncHandler(async (req, res) => {
    const data = await service.sellerMessage(req.params.sellRequestId, req.body, req.actor, req);
    publishSellerActivity(String(data.sellRequest?._id ?? req.params.sellRequestId), data);
    res.status(201).json({ data, meta: { requestId: res.locals.requestId } });
  }),
  createMeSellRequestsVisitsAction: asyncHandler(async (req, res) => {
    const data = await service.sellerVisitAction(req.params.sellRequestId, req.params.visitId, req.body, req.actor, req);
    res.json({ data, meta: { requestId: res.locals.requestId } });
  }),
  getMeSellRequestsDocuments: asyncHandler(async (req, res) => {
    const data = await service.sellerDocuments(req.params.sellRequestId, req.actor);
    res.json({ data, meta: { requestId: res.locals.requestId } });
  }),
  createMeSellRequestsPayoutScheduleConfirm: asyncHandler(async (req, res) => {
    const data = await service.confirmPayoutSchedule(req.params.sellRequestId, req.actor, req);
    res.json({ data, meta: { requestId: res.locals.requestId } });
  }),
  createMeSellRequestsRegistrationConfirm: asyncHandler(async (req, res) => {
    const data = await service.confirmRegistration(req.params.sellRequestId, req.body, req.actor, req);
    res.json({ data, meta: { requestId: res.locals.requestId } });
  }),
  createMeSellRequestsValuationEstimate: asyncHandler(async (req, res) => {
    const data = await service.marketEstimate(req.params.sellRequestId, req.body, req.actor);
    res.json({ data, meta: { requestId: res.locals.requestId } });
  }),
  updateAdminSellRequestsById: asyncHandler(async (req, res) => {
    const data = await service.adminUpdate(req.params.sellRequestId, req.body, req.actor, req);
    res.json({ data, meta: { requestId: res.locals.requestId } });
  }),
  createAdminSellRequestsCreateAcquisition: asyncHandler(async (req, res) => {
    const { service: acquisitionService } = await import("../acquisitions/acquisitions.service.js");
    const data = await acquisitionService.create({ ...req.body, sellRequestId: req.params.sellRequestId }, req.actor);
    res.status(201).json({ data, meta: { requestId: res.locals.requestId } });
  })
};
