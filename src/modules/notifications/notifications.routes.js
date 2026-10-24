import { Router } from "express";
import { controller } from "./notifications.controller.js";
import { validate } from "../../middleware/validate.js";
import { authenticate, requireAnyPermission } from "../../middleware/auth.js";
import { STAFF_READ_PERMISSIONS, STAFF_WRITE_PERMISSIONS } from "../../constants/permissions.js";
import { listValidator, markReadValidator, updateValidator, sendPushValidator } from "./notifications.validation.js";
const router = Router();

router.get("/me/notifications", authenticate("customer"), validate(listValidator), controller.mine);
router.get(
  "/me/notifications/unread-count",
  authenticate("customer"),
  controller.getMeNotificationsUnreadCount
);
router.patch(
  "/me/notifications/read",
  authenticate("customer"),
  validate(markReadValidator),
  controller.updateMeNotificationsRead
);
router.patch(
  "/me/notifications/:id/read",
  authenticate("customer"),
  validate(markReadValidator),
  controller.updateMeNotificationReadById
);
router.delete(
  "/me/notifications/:id",
  authenticate("customer"),
  validate(markReadValidator),
  controller.removeMeNotificationsById
);

const toolsWrite = ["properties.write", "support.write", "admin.access.manage"];
router.get("/admin/notifications", authenticate("admin"), requireAnyPermission(STAFF_READ_PERMISSIONS), validate(listValidator), controller.list);
router.patch("/admin/notifications/:id", authenticate("admin"), requireAnyPermission(STAFF_WRITE_PERMISSIONS), validate(updateValidator), controller.update);
router.post(
  "/admin/notifications/push",
  authenticate("admin"),
  requireAnyPermission(toolsWrite),
  validate(sendPushValidator),
  controller.createAdminNotificationsPush
);
router.post(
  "/admin/notifications/:id/retry",
  authenticate("admin"),
  requireAnyPermission(toolsWrite),
  validate(markReadValidator),
  controller.createAdminNotificationsRetry
);

export default router;
