import { Router } from "express";
import { controller } from "./content.controller.js";
import { validate } from "../../middleware/validate.js";
import { authenticate, requireAnyPermission } from "../../middleware/auth.js";
import { createValidator, listValidator, publicListValidator, reorderValidator, updateValidator } from "./content.validation.js";

const router = Router();

router.get("/content", validate(publicListValidator), controller.listPublic);
router.get("/content/:slug", controller.getPublic);

const toolsRead = ["properties.write", "support.read", "support.write", "admin.access.manage"];
const toolsWrite = ["properties.write", "support.write", "admin.access.manage"];
router.get("/admin/content", authenticate("admin"), requireAnyPermission(toolsRead), validate(listValidator), controller.list);
router.post("/admin/content", authenticate("admin"), requireAnyPermission(toolsWrite), validate(createValidator), controller.create);
router.patch("/admin/content/reorder", authenticate("admin"), requireAnyPermission(toolsWrite), validate(reorderValidator), controller.reorder);
router.patch("/admin/content/:contentId", authenticate("admin"), requireAnyPermission(toolsWrite), validate(updateValidator), controller.update);
router.delete("/admin/content/:contentId", authenticate("admin"), requireAnyPermission(toolsWrite), controller.remove);

export default router;
