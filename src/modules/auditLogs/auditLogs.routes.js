import { Router } from "express";
import { controller } from "./auditLogs.controller.js";
import { validateZod } from "../../middleware/validateZod.js";
import { authenticate, requirePermission } from "../../middleware/auth.js";
import { listSchema } from "./auditLogs.schemas.js";
const router = Router();
router.get("/admin/audit-logs", authenticate("admin"), requirePermission("audit.read"), validateZod(listSchema), controller.list);
export default router;