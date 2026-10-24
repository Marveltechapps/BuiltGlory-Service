import { Router } from "express";
import { controller } from "./communicationLogs.controller.js";
import multer from "multer";
import { authenticate, requireAnyPermission } from "../../middleware/auth.js";
import { STAFF_READ_PERMISSIONS, STAFF_WRITE_PERMISSIONS } from "../../constants/permissions.js";
import { validate } from "../../middleware/validate.js";
import { createForEntityValidator, createValidator, emailValidator, listValidator, pushValidator, timelineValidator } from "./communicationLogs.validation.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });
const router = Router();

router.get("/admin/workflow/:entityType/:entityId/logs", authenticate("admin"), requireAnyPermission(STAFF_READ_PERMISSIONS), validate(timelineValidator), controller.getAdminWorkflowLogs);

router.get("/admin/:entityType/:entityId/timeline", authenticate("admin"), requireAnyPermission(STAFF_READ_PERMISSIONS), validate(timelineValidator), controller.getAdminTimeline);

router.get("/admin/communication-logs", authenticate("admin"), requireAnyPermission(STAFF_READ_PERMISSIONS), validate(listValidator), controller.getAdminCommunicationLogs);

router.post("/admin/communication-logs", authenticate("admin"), requireAnyPermission(STAFF_WRITE_PERMISSIONS), validate(createValidator), controller.createAdminCommunicationLogs);

router.post("/admin/workflow/:entityType/:entityId/logs", authenticate("admin"), requireAnyPermission(STAFF_WRITE_PERMISSIONS), validate(createForEntityValidator), controller.createAdminWorkflowLogs);

router.post("/admin/workflow/:entityType/:entityId/push", authenticate("admin"), requireAnyPermission(STAFF_WRITE_PERMISSIONS), validate(pushValidator), controller.createAdminWorkflowPush);

router.post("/admin/workflow/:entityType/:entityId/email", authenticate("admin"), requireAnyPermission(STAFF_WRITE_PERMISSIONS), validate(emailValidator), controller.createAdminWorkflowEmail);

router.post("/admin/workflow/:entityType/:entityId/proofs", authenticate("admin"), requireAnyPermission(STAFF_WRITE_PERMISSIONS), upload.single("file"), controller.createAdminWorkflowProofs);

router.delete("/admin/workflow/logs/:logId", authenticate("admin"), requireAnyPermission(STAFF_WRITE_PERMISSIONS), controller.removeAdminWorkflowLogsById);

export default router;
