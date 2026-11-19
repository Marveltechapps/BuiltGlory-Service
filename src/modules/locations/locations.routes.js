import { Router } from "express";
import { authenticate, requireAnyPermission } from "../../middleware/auth.js";
import { validateZod } from "../../middleware/validateZod.js";
import { controller } from "./locations.controller.js";
import { createSchema, idParam, listSchema, updateSchema } from "./locations.schemas.js";

const router = Router();

const toolsRead = ["properties.write", "support.read", "support.write", "admin.access.manage"];
const toolsWrite = ["properties.write", "support.write", "admin.access.manage"];

router.get("/admin/locations", authenticate("admin"), requireAnyPermission(toolsRead), validateZod(listSchema), controller.list);
router.post("/admin/locations", authenticate("admin"), requireAnyPermission(toolsWrite), validateZod(createSchema), controller.create);
router.get("/admin/locations/:locationId", authenticate("admin"), requireAnyPermission(toolsRead), validateZod(idParam), controller.get);
router.patch("/admin/locations/:locationId", authenticate("admin"), requireAnyPermission(toolsWrite), validateZod(updateSchema), controller.update);
router.delete("/admin/locations/:locationId", authenticate("admin"), requireAnyPermission(toolsWrite), validateZod(idParam), controller.remove);

export default router;
