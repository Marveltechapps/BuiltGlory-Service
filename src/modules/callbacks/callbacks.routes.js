import { Router } from "express";
import { controller } from "./callbacks.controller.js";
import { validate } from "../../middleware/validate.js";
import { authenticate, requireAnyPermission } from "../../middleware/auth.js";
import { listValidator, createValidator, updateValidator } from "./callbacks.validation.js";
const router = Router();
router.post("/callbacks", authenticate("customer"), validate(createValidator), controller.create);
router.get("/admin/callbacks", authenticate("admin"), requireAnyPermission(["enquiries.read", "support.read"]), validate(listValidator), controller.list);
router.get("/admin/callbacks/:callbackId", authenticate("admin"), requireAnyPermission(["enquiries.read", "support.read"]), controller.get);
router.post("/admin/callbacks/:callbackId/attempts", authenticate("admin"), requireAnyPermission(["enquiries.write", "support.write"]), validate(updateValidator), controller.action(async (req, res) => {
  const data = await import("./callbacks.service.js").then((m) => m.service.addAttempt(req.params.callbackId, req.body, req.actor, req));
  res.status(201).json({ data, meta: { requestId: res.locals.requestId } });
}));
router.patch("/admin/callbacks/:callbackId/resolve", authenticate("admin"), requireAnyPermission(["enquiries.write", "support.write"]), validate(updateValidator), controller.action(async (req, res) => {
  const data = await import("./callbacks.service.js").then((m) => m.service.transition(req.params.callbackId, "resolved", req.actor, req, req.body || {}));
  res.json({ data, meta: { requestId: res.locals.requestId } });
}));
router.patch("/admin/callbacks/:callbackId/reschedule", authenticate("admin"), requireAnyPermission(["enquiries.write", "support.write"]), validate(updateValidator), controller.action(async (req, res) => {
  const data = await import("./callbacks.service.js").then((m) => m.service.transition(req.params.callbackId, "rescheduled", req.actor, req, req.body || {}));
  res.json({ data, meta: { requestId: res.locals.requestId } });
}));
export default router;