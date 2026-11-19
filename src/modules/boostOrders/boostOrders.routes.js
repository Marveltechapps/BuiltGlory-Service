import { Router } from "express";
import { authenticate, requireAnyPermission } from "../../middleware/auth.js";
import { validateZod } from "../../middleware/validateZod.js";
import { controller } from "./boostOrders.controller.js";
import { createSchema, idParam, listSchema, updateSchema } from "./boostOrders.schemas.js";

const router = Router();

const toolsRead = ["properties.write", "support.read", "support.write", "admin.access.manage"];
const toolsWrite = ["properties.write", "support.write", "admin.access.manage"];

router.get("/admin/boost-orders", authenticate("admin"), requireAnyPermission(toolsRead), validateZod(listSchema), controller.list);
router.post("/admin/boost-orders", authenticate("admin"), requireAnyPermission(toolsWrite), validateZod(createSchema), controller.create);
router.get("/admin/boost-orders/:boostOrderId", authenticate("admin"), requireAnyPermission(toolsRead), validateZod(idParam), controller.get);
router.patch("/admin/boost-orders/:boostOrderId", authenticate("admin"), requireAnyPermission(toolsWrite), validateZod(updateSchema), controller.update);

export default router;
