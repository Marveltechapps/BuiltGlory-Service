import { Router } from "express";
import { controller } from "./sellRequests.controller.js";
import { validate } from "../../middleware/validate.js";
import { authenticate, requireAnyPermission } from "../../middleware/auth.js";
import { listValidator, createValidator, updateValidator, adminUpdateValidator, statusValidator, offerDecisionValidator, valuationEstimateValidator, sellerMessageValidator, sellerVisitActionValidator, sellerAvailabilityValidator, registrationConfirmValidator } from "./sellRequests.validation.js";
import { publishSellerActivity } from "../../realtime/chatSocket.js";
const router = Router();
router.post("/sell-requests", authenticate("customer"), validate(createValidator), controller.create);
router.post("/sell-requests/drafts", authenticate("customer"), validate(createValidator), controller.action(async (req, res) => {
  const data = await import("./sellRequests.service.js").then((m) => m.service.create({ ...req.body, status: "draft", isDraft: true }, req.actor));
  res.status(201).json({ data, meta: { requestId: res.locals.requestId } });
}));
router.get("/me/sell-requests", authenticate("customer"), validate(listValidator), controller.mine);
router.get("/me/sell-requests/:sellRequestId", authenticate("customer"), controller.get);
router.get("/me/sell-requests/:sellRequestId/activity", authenticate("customer"), controller.action(async (req, res) => {
  const data = await import("./sellRequests.service.js").then((m) => m.service.sellerActivity(req.params.sellRequestId, req.actor));
  res.json({ data, meta: { requestId: res.locals.requestId } });
}));
router.patch("/me/sell-requests/:sellRequestId", authenticate("customer"), validate(updateValidator), controller.update);
router.put("/me/sell-requests/:sellRequestId/availability", authenticate("customer"), validate(sellerAvailabilityValidator), controller.action(async (req, res) => {
  const data = await import("./sellRequests.service.js").then((m) => m.service.setSellerAvailability(req.params.sellRequestId, req.body, req.actor));
  res.json({ data, meta: { requestId: res.locals.requestId } });
}));
router.post("/me/sell-requests/:sellRequestId/withdraw", authenticate("customer"), controller.action(async (req, res) => {
  const data = await import("./sellRequests.service.js").then((m) => m.service.withdraw(req.params.sellRequestId, req.actor, req));
  res.json({ data, meta: { requestId: res.locals.requestId } });
}));
router.post("/me/sell-requests/:sellRequestId/submit", authenticate("customer"), controller.action(async (req, res) => {
  const { isDraft, status, draftStep, draftSavedAt, ...safeBody } = req.body || {};
  const data = await import("./sellRequests.service.js").then((m) => m.service.transition(req.params.sellRequestId, "new", req.actor, req, safeBody));
  res.json({ data, meta: { requestId: res.locals.requestId } });
}));
router.post("/me/sell-requests/:sellRequestId/offer-decision", authenticate("customer"), validate(offerDecisionValidator), controller.action(async (req, res) => {
  const data = await import("./sellRequests.service.js").then((m) => m.service.sellerOfferDecision(req.params.sellRequestId, req.body, req.actor, req));
  res.json({ data, meta: { requestId: res.locals.requestId } });
}));
router.post("/me/sell-requests/:sellRequestId/messages", authenticate("customer"), validate(sellerMessageValidator), controller.action(async (req, res) => {
  const data = await import("./sellRequests.service.js").then((m) => m.service.sellerMessage(req.params.sellRequestId, req.body, req.actor, req));
  publishSellerActivity(String(data.sellRequest?._id ?? req.params.sellRequestId), data);
  res.status(201).json({ data, meta: { requestId: res.locals.requestId } });
}));
router.post("/me/sell-requests/:sellRequestId/visits/:visitId/action", authenticate("customer"), validate(sellerVisitActionValidator), controller.action(async (req, res) => {
  const data = await import("./sellRequests.service.js").then((m) => m.service.sellerVisitAction(req.params.sellRequestId, req.params.visitId, req.body, req.actor, req));
  res.json({ data, meta: { requestId: res.locals.requestId } });
}));
router.get("/me/sell-requests/:sellRequestId/documents", authenticate("customer"), controller.action(async (req, res) => {
  const data = await import("./sellRequests.service.js").then((m) => m.service.sellerDocuments(req.params.sellRequestId, req.actor));
  res.json({ data, meta: { requestId: res.locals.requestId } });
}));
router.post("/me/sell-requests/:sellRequestId/payout-schedule/confirm", authenticate("customer"), controller.action(async (req, res) => {
  const data = await import("./sellRequests.service.js").then((m) => m.service.confirmPayoutSchedule(req.params.sellRequestId, req.actor, req));
  res.json({ data, meta: { requestId: res.locals.requestId } });
}));
router.post("/me/sell-requests/:sellRequestId/registration/confirm", authenticate("customer"), validate(registrationConfirmValidator), controller.action(async (req, res) => {
  const data = await import("./sellRequests.service.js").then((m) => m.service.confirmRegistration(req.params.sellRequestId, req.body, req.actor, req));
  res.json({ data, meta: { requestId: res.locals.requestId } });
}));
router.post("/me/sell-requests/:sellRequestId/valuation-estimate", authenticate("customer"), validate(valuationEstimateValidator), controller.action(async (req, res) => {
  const data = await import("./sellRequests.service.js").then((m) => m.service.marketEstimate(req.params.sellRequestId, req.body, req.actor));
  res.json({ data, meta: { requestId: res.locals.requestId } });
}));
router.get("/admin/sell-requests", authenticate("admin"), requireAnyPermission(["acquisitions.read", "enquiries.read"]), validate(listValidator), controller.list);
router.get("/admin/sell-requests/:sellRequestId", authenticate("admin"), requireAnyPermission(["acquisitions.read", "enquiries.read"]), controller.get);
router.patch("/admin/sell-requests/:sellRequestId", authenticate("admin"), requireAnyPermission(["acquisitions.write", "enquiries.write"]), validate(adminUpdateValidator), controller.action(async (req, res) => {
  const data = await import("./sellRequests.service.js").then((m) => m.service.adminUpdate(req.params.sellRequestId, req.body, req.actor, req));
  res.json({ data, meta: { requestId: res.locals.requestId } });
}));
router.patch("/admin/sell-requests/:sellRequestId/review", authenticate("admin"), requireAnyPermission(["acquisitions.write", "enquiries.write"]), validate(statusValidator), controller.transition("decision"));
router.post("/admin/sell-requests/:sellRequestId/create-acquisition", authenticate("admin"), requireAnyPermission(["acquisitions.write", "enquiries.write"]), controller.action(async (req, res) => {
  const { service: acquisitionService } = await import("../acquisitions/acquisitions.service.js");
  const data = await acquisitionService.create({ ...req.body, sellRequestId: req.params.sellRequestId }, req.actor);
  res.status(201).json({ data, meta: { requestId: res.locals.requestId } });
}));
export default router;