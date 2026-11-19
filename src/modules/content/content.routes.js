import { Router } from "express";
import { controller } from "./content.controller.js";
import { validateZod } from "../../middleware/validateZod.js";
import { authenticate, requireAnyPermission } from "../../middleware/auth.js";
import { createSchema, listSchema, publicListSchema, reorderSchema, updateSchema } from "./content.schemas.js";

const router = Router();

router.get("/content", validateZod(publicListSchema), controller.listPublic);
router.get("/content/:slug", controller.getPublic);

const toolsRead = ["properties.write", "support.read", "support.write", "admin.access.manage"];
const toolsWrite = ["properties.write", "support.write", "admin.access.manage"];
router.get("/admin/content", authenticate("admin"), requireAnyPermission(toolsRead), validateZod(listSchema), controller.list);
router.post("/admin/content", authenticate("admin"), requireAnyPermission(toolsWrite), validateZod(createSchema), controller.create);
router.patch("/admin/content/reorder", authenticate("admin"), requireAnyPermission(toolsWrite), validateZod(reorderSchema), controller.reorder);
router.patch("/admin/content/:contentId", authenticate("admin"), requireAnyPermission(toolsWrite), validateZod(updateSchema), controller.update);
router.delete("/admin/content/:contentId", authenticate("admin"), requireAnyPermission(toolsWrite), controller.remove);

export default router;
