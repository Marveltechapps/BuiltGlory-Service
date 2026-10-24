import { Router } from "express";
import { controller } from "./visits.controller.js";
import { validate } from "../../middleware/validate.js";
import { authenticate, requirePermission } from "../../middleware/auth.js";
import { listValidator, availabilityValidator, createValidator, updateValidator, statusValidator } from "./visits.validation.js";
const router = Router();
router.get("/me/visits", authenticate("customer"), validate(listValidator), controller.action(async (req, res) => {
  const result = await import("./visits.service.js").then((m) => m.service.listMine(req.actor, req.query));
  res.json({ data: result.data, meta: { ...result.meta, requestId: res.locals.requestId } });
}));
router.get("/visits/availability", authenticate("customer"), validate(availabilityValidator), controller.action(async (req, res) => {
  const data = await import("./visits.service.js").then((m) => m.service.availability(req.query, req.actor));
  res.json({ data, meta: { requestId: res.locals.requestId } });
}));
router.post("/visits", authenticate("customer"), validate(createValidator), controller.create);
router.patch("/visits/:visitId/reschedule", authenticate("customer"), validate(updateValidator), controller.action(async (req, res) => {
  const data = await import("./visits.service.js").then((m) => m.service.transition(req.params.visitId, "rescheduled", req.actor, req, req.body || {}));
  res.json({ data, meta: { requestId: res.locals.requestId } });
}));
router.patch("/visits/:visitId/cancel", authenticate("customer"), validate(updateValidator), controller.action(async (req, res) => {
  const data = await import("./visits.service.js").then((m) => m.service.transition(req.params.visitId, "cancelled", req.actor, req, req.body || {}));
  res.json({ data, meta: { requestId: res.locals.requestId } });
}));
router.get("/admin/visits", authenticate("admin"), requirePermission("enquiries.read"), validate(listValidator), controller.list);
router.get("/admin/visits/:visitId", authenticate("admin"), requirePermission("enquiries.read"), controller.get);
router.patch("/admin/visits/:visitId/status", authenticate("admin"), requirePermission("enquiries.write"), validate(statusValidator), controller.transition("status"));
router.post("/admin/visits/:visitId/feedback", authenticate("admin"), requirePermission("enquiries.write"), validate(updateValidator), controller.update);
router.post("/admin/visits/:visitId/call-logs", authenticate("admin"), requirePermission("enquiries.write"), validate(updateValidator), controller.update);
export default router;