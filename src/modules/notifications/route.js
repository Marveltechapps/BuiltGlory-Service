import { Router } from "express";
import { controller } from "./controller.js";
import { validate } from "../../middleware/validate.js";
import { authenticate, requireAnyPermission } from "../../middleware/auth.js";
import { STAFF_READ_PERMISSIONS, STAFF_WRITE_PERMISSIONS } from "../../constants/permissions.js";
import { listValidator, markReadValidator, updateValidator, sendPushValidator } from "./validator.js";
import { asyncHandler } from "../../shared/asyncHandler.js";

const router = Router();

router.get("/me/notifications", authenticate("customer"), validate(listValidator), controller.mine);
router.get(
  "/me/notifications/unread-count",
  authenticate("customer"),
  controller.action(async (req, res) => {
    const data = await import("./service.js").then((m) => m.service.countUnread(req.actor));
    res.json({ data, meta: { requestId: res.locals.requestId } });
  })
);
router.patch(
  "/me/notifications/read",
  authenticate("customer"),
  validate(markReadValidator),
  controller.action(async (req, res) => {
    const data = await import("./service.js").then((m) => m.service.markMineRead(req.actor, req.body.ids || []));
    res.json({ data, meta: { requestId: res.locals.requestId } });
  })
);
router.patch(
  "/me/notifications/:id/read",
  authenticate("customer"),
  validate(markReadValidator),
  controller.action(async (req, res) => {
    const data = await import("./service.js").then((m) => m.service.markOneRead(req.params.id, req.actor));
    res.json({ data, meta: { requestId: res.locals.requestId } });
  })
);
router.delete(
  "/me/notifications/:id",
  authenticate("customer"),
  validate(markReadValidator),
  controller.action(async (req, res) => {
    const data = await import("./service.js").then((m) => m.service.deleteMine(req.params.id, req.actor));
    res.json({ data, meta: { requestId: res.locals.requestId } });
  })
);

const toolsWrite = ["properties.write", "support.write", "admin.access.manage"];
router.get("/admin/notifications", authenticate("admin"), requireAnyPermission(STAFF_READ_PERMISSIONS), validate(listValidator), controller.list);
router.patch("/admin/notifications/:id", authenticate("admin"), requireAnyPermission(STAFF_WRITE_PERMISSIONS), validate(updateValidator), controller.update);
router.post(
  "/admin/notifications/push",
  authenticate("admin"),
  requireAnyPermission(toolsWrite),
  validate(sendPushValidator),
  asyncHandler(async (req, res) => {
    const data = await import("./service.js").then((m) => m.service.sendManual(req.body, req.actor, req));
    res.status(201).json({ data, meta: { requestId: res.locals.requestId } });
  })
);
router.post(
  "/admin/notifications/:id/retry",
  authenticate("admin"),
  requireAnyPermission(toolsWrite),
  validate(markReadValidator),
  asyncHandler(async (req, res) => {
    const data = await import("./service.js").then((m) => m.service.retry(req.params.id, req.actor, req));
    res.json({ data, meta: { requestId: res.locals.requestId } });
  })
);

export default router;
