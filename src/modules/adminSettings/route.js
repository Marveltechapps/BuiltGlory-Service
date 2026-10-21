import { Router } from "express";
import { authenticate, requireAnyPermission, requirePermission } from "../../middleware/auth.js";
import { STAFF_READ_PERMISSIONS } from "../../constants/permissions.js";
import { validate } from "../../middleware/validate.js";
import { controller } from "./controller.js";
import { updateValidator } from "./validator.js";

const router = Router();

router.get("/admin/settings", authenticate("admin"), requireAnyPermission(STAFF_READ_PERMISSIONS), controller.get);
router.patch("/admin/settings", authenticate("admin"), requirePermission("admin.access.manage"), validate(updateValidator), controller.update);

export default router;
