import { Router } from "express";
import { controller } from "./supportTickets.controller.js";
import { validate } from "../../middleware/validate.js";
import { authenticate, requirePermission } from "../../middleware/auth.js";
import {
  listValidator,
  createValidator,
  updateValidator,
  responseValidator,
  liveChatStartValidator
} from "./supportTickets.validation.js";
const router = Router();

router.post("/support/tickets", authenticate("customer"), validate(createValidator), controller.create);

router.get("/me/support/tickets", authenticate("customer"), validate(listValidator), controller.mine);
router.get("/me/support/live-chat", authenticate("customer"), controller.getMeSupportLiveChat);
router.post("/me/support/live-chat", authenticate("customer"), validate(liveChatStartValidator), controller.createMeSupportLiveChat);

router.get("/me/support/tickets/:ticketId", authenticate("customer"), controller.get);
router.post(
  "/me/support/tickets/:ticketId/responses",
  authenticate("customer"),
  validate(responseValidator),
  controller.createMeSupportTicketsResponses
);
router.post("/me/support/tickets/:ticketId/read", authenticate("customer"), controller.createMeSupportTicketsRead);
router.post("/me/support/tickets/:ticketId/close", authenticate("customer"), controller.createMeSupportTicketsClose);
router.post("/me/support/tickets/:ticketId/reopen", authenticate("customer"), controller.createMeSupportTicketsReopen);

router.get("/admin/support/tickets", authenticate("admin"), requirePermission("support.read"), validate(listValidator), controller.list);
router.get("/admin/support/tickets/:ticketId", authenticate("admin"), requirePermission("support.read"), controller.get);
router.post(
  "/admin/support/tickets/:ticketId/responses",
  authenticate("admin"),
  requirePermission("support.write"),
  validate(updateValidator),
  controller.createAdminSupportTicketsResponses
);
router.post(
  "/admin/support/tickets/:ticketId/read",
  authenticate("admin"),
  requirePermission("support.read"),
  controller.createAdminSupportTicketsRead
);
router.post(
  "/admin/support/tickets/:ticketId/close",
  authenticate("admin"),
  requirePermission("support.write"),
  controller.createAdminSupportTicketsClose
);
router.post(
  "/admin/support/tickets/:ticketId/reopen",
  authenticate("admin"),
  requirePermission("support.write"),
  controller.createAdminSupportTicketsReopen
);
router.patch("/admin/support/tickets/:ticketId", authenticate("admin"), requirePermission("support.write"), validate(updateValidator), controller.update);

export default router;
