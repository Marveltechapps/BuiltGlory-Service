import { Router } from "express";
import { controller } from "./editLocks.controller.js";
import { authenticate } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { lockParamsValidator, lockValidator } from "./editLocks.validation.js";

const router = Router();

router.get("/admin/workflow/:entityType/:entityId/lock", authenticate("admin"), validate(lockParamsValidator), controller.getAdminWorkflowLock);

router.post("/admin/workflow/:entityType/:entityId/lock", authenticate("admin"), validate(lockValidator), controller.createAdminWorkflowLock);

router.delete("/admin/workflow/:entityType/:entityId/lock", authenticate("admin"), validate(lockParamsValidator), controller.removeAdminWorkflowLock);

export default router;
