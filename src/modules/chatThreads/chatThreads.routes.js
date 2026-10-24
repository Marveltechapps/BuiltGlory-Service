import { Router } from "express";
import { controller } from "./chatThreads.controller.js";
import { validate } from "../../middleware/validate.js";
import { authenticate, requireAnyPermission } from "../../middleware/auth.js";
import { listValidator, updateValidator } from "./chatThreads.validation.js";
const router = Router();
router.get("/admin/negotiations/chats", authenticate("admin"), requireAnyPermission(["enquiries.read", "sales.read"]), validate(listValidator), controller.list);
router.get("/admin/negotiations/chats/:threadId", authenticate("admin"), requireAnyPermission(["enquiries.read", "sales.read"]), controller.get);
router.post("/admin/negotiations/chats/:threadId/messages", authenticate("admin"), requireAnyPermission(["enquiries.write", "sales.write"]), validate(updateValidator), controller.action(async (req, res) => {
  const data = await import("./chatThreads.service.js").then((m) => m.service.addMessage(req.params.threadId, req.body, req.actor, req));
  res.status(201).json({ data, meta: { requestId: res.locals.requestId } });
}));
router.patch("/admin/negotiations/chats/:threadId/offers/:messageId", authenticate("admin"), requireAnyPermission(["enquiries.write", "sales.write"]), validate(updateValidator), controller.action(async (req, res) => {
  const data = await import("./chatThreads.service.js").then((m) => m.service.respondToOffer(req.params.threadId, req.params.messageId, req.body, req.actor, req));
  res.json({ data, meta: { requestId: res.locals.requestId } });
}));
export default router;