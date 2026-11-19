import { Router } from "express";
import { controller } from "./editLocks.controller.js";
import { authenticate } from "../../middleware/auth.js";
import { validateZod } from "../../middleware/validateZod.js";
import { lockParamsSchema, lockSchema } from "./editLocks.schemas.js";

const router = Router();

router.get("/admin/workflow/:entityType/:entityId/lock", authenticate("admin"), validateZod(lockParamsSchema), controller.getAdminWorkflowLock);

router.post("/admin/workflow/:entityType/:entityId/lock", authenticate("admin"), validateZod(lockSchema), controller.createAdminWorkflowLock);

router.delete("/admin/workflow/:entityType/:entityId/lock", authenticate("admin"), validateZod(lockParamsSchema), controller.removeAdminWorkflowLock);

export default router;
