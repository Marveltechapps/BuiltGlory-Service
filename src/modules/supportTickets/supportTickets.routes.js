import { Router } from "express";
import { controller } from "./supportTickets.controller.js";
import { validateZod } from "../../middleware/validateZod.js";
import { authenticate, requirePermission } from "../../middleware/auth.js";
import {
  listSchema,
  createSchema,
  updateSchema,
  responseSchema,
  liveChatStartSchema
} from "./supportTickets.schemas.js";
const router = Router();

router.post("/support/tickets", authenticate("customer"), validateZod(createSchema), controller.create);

router.get("/me/support/tickets", authenticate("customer"), validateZod(listSchema), controller.mine);
router.get("/me/support/live-chat", authenticate("customer"), controller.getMeSupportLiveChat);
router.post("/me/support/live-chat", authenticate("customer"), validateZod(liveChatStartSchema), controller.createMeSupportLiveChat);

router.get("/me/support/tickets/:ticketId", authenticate("customer"), controller.get);
router.post(
  "/me/support/tickets/:ticketId/responses",
  authenticate("customer"),
  validateZod(responseSchema),
  controller.createMeSupportTicketsResponses
);
router.post("/me/support/tickets/:ticketId/read", authenticate("customer"), controller.createMeSupportTicketsRead);
router.post("/me/support/tickets/:ticketId/close", authenticate("customer"), controller.createMeSupportTicketsClose);
router.post("/me/support/tickets/:ticketId/reopen", authenticate("customer"), controller.createMeSupportTicketsReopen);

router.get("/admin/support/tickets", authenticate("admin"), requirePermission("support.read"), validateZod(listSchema), controller.list);
router.get("/admin/support/tickets/:ticketId", authenticate("admin"), requirePermission("support.read"), controller.get);
router.post(
  "/admin/support/tickets/:ticketId/responses",
  authenticate("admin"),
  requirePermission("support.write"),
  validateZod(updateSchema),
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
router.patch("/admin/support/tickets/:ticketId", authenticate("admin"), requirePermission("support.write"), validateZod(updateSchema), controller.update);

export default router;
