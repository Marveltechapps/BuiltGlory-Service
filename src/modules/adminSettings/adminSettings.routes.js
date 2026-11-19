import { Router } from "express";
import { authenticate, requireAnyPermission, requirePermission } from "../../middleware/auth.js";
import { STAFF_READ_PERMISSIONS } from "../../constants/permissions.js";
import { validateZod } from "../../middleware/validateZod.js";
import { controller } from "./adminSettings.controller.js";
import { updateSchema } from "./adminSettings.schemas.js";

const router = Router();

router.get("/admin/settings", authenticate("admin"), requireAnyPermission(STAFF_READ_PERMISSIONS), controller.get);
router.patch("/admin/settings", authenticate("admin"), requirePermission("admin.access.manage"), validateZod(updateSchema), controller.update);

export default router;
