import { Router } from "express";
import { controller } from "./appFeedback.controller.js";
import { validateZod } from "../../middleware/validateZod.js";
import { authenticate, requirePermission } from "../../middleware/auth.js";
import { createSchema, listSchema, updateSchema } from "./appFeedback.schemas.js";

const router = Router();

router.post("/feedback", authenticate("customer"), validateZod(createSchema), controller.create);
router.get("/me/feedback", authenticate("customer"), validateZod(listSchema), controller.mine);
router.get("/admin/feedback", authenticate("admin"), requirePermission("support.read"), validateZod(listSchema), controller.list);
router.patch("/admin/feedback/:id", authenticate("admin"), requirePermission("support.write"), validateZod(updateSchema), controller.update);

export default router;
