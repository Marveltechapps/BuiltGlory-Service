import { Router } from "express";
import { controller } from "./communicationLogs.controller.js";
import multer from "multer";
import { authenticate, requireAnyPermission } from "../../middleware/auth.js";
import { STAFF_READ_PERMISSIONS, STAFF_WRITE_PERMISSIONS } from "../../constants/permissions.js";
import { validateZod } from "../../middleware/validateZod.js";
import { createForEntitySchema, createSchema, emailSchema, listSchema, pushSchema, timelineSchema } from "./communicationLogs.schemas.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });
const router = Router();

router.get("/admin/workflow/:entityType/:entityId/logs", authenticate("admin"), requireAnyPermission(STAFF_READ_PERMISSIONS), validateZod(timelineSchema), controller.getAdminWorkflowLogs);

router.get("/admin/:entityType/:entityId/timeline", authenticate("admin"), requireAnyPermission(STAFF_READ_PERMISSIONS), validateZod(timelineSchema), controller.getAdminTimeline);

router.get("/admin/communication-logs", authenticate("admin"), requireAnyPermission(STAFF_READ_PERMISSIONS), validateZod(listSchema), controller.getAdminCommunicationLogs);

router.post("/admin/communication-logs", authenticate("admin"), requireAnyPermission(STAFF_WRITE_PERMISSIONS), validateZod(createSchema), controller.createAdminCommunicationLogs);

router.post("/admin/workflow/:entityType/:entityId/logs", authenticate("admin"), requireAnyPermission(STAFF_WRITE_PERMISSIONS), validateZod(createForEntitySchema), controller.createAdminWorkflowLogs);

router.post("/admin/workflow/:entityType/:entityId/push", authenticate("admin"), requireAnyPermission(STAFF_WRITE_PERMISSIONS), validateZod(pushSchema), controller.createAdminWorkflowPush);

router.post("/admin/workflow/:entityType/:entityId/email", authenticate("admin"), requireAnyPermission(STAFF_WRITE_PERMISSIONS), validateZod(emailSchema), controller.createAdminWorkflowEmail);

router.post("/admin/workflow/:entityType/:entityId/proofs", authenticate("admin"), requireAnyPermission(STAFF_WRITE_PERMISSIONS), upload.single("file"), controller.createAdminWorkflowProofs);

router.delete("/admin/workflow/logs/:logId", authenticate("admin"), requireAnyPermission(STAFF_WRITE_PERMISSIONS), controller.removeAdminWorkflowLogsById);

export default router;
