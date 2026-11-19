import { Router } from "express";
import { controller } from "./notifications.controller.js";
import { validateZod } from "../../middleware/validateZod.js";
import { authenticate, requireAnyPermission } from "../../middleware/auth.js";
import { STAFF_READ_PERMISSIONS, STAFF_WRITE_PERMISSIONS } from "../../constants/permissions.js";
import { listSchema, markReadSchema, updateSchema, sendPushSchema } from "./notifications.schemas.js";
const router = Router();

router.get("/me/notifications", authenticate("customer"), validateZod(listSchema), controller.mine);
router.get(
  "/me/notifications/unread-count",
  authenticate("customer"),
  controller.getMeNotificationsUnreadCount
);
router.patch(
  "/me/notifications/read",
  authenticate("customer"),
  validateZod(markReadSchema),
  controller.updateMeNotificationsRead
);
router.patch(
  "/me/notifications/:id/read",
  authenticate("customer"),
  validateZod(markReadSchema),
  controller.updateMeNotificationReadById
);
router.delete(
  "/me/notifications/:id",
  authenticate("customer"),
  validateZod(markReadSchema),
  controller.removeMeNotificationsById
);

const toolsWrite = ["properties.write", "support.write", "admin.access.manage"];
router.get("/admin/notifications", authenticate("admin"), requireAnyPermission(STAFF_READ_PERMISSIONS), validateZod(listSchema), controller.list);
router.patch("/admin/notifications/:id", authenticate("admin"), requireAnyPermission(STAFF_WRITE_PERMISSIONS), validateZod(updateSchema), controller.update);
router.post(
  "/admin/notifications/push",
  authenticate("admin"),
  requireAnyPermission(toolsWrite),
  validateZod(sendPushSchema),
  controller.createAdminNotificationsPush
);
router.post(
  "/admin/notifications/:id/retry",
  authenticate("admin"),
  requireAnyPermission(toolsWrite),
  validateZod(markReadSchema),
  controller.createAdminNotificationsRetry
);

export default router;
