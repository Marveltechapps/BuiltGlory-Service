import { Router } from "express";
import { authenticate, requireAnyPermission } from "../../middleware/auth.js";
import { validateZod } from "../../middleware/validateZod.js";
import { controller } from "./search.controller.js";
import { searchSchema } from "./search.schemas.js";

const router = Router();

router.get("/search/trending", controller.getSearchTrending);

router.get("/me/searches", authenticate("customer"), controller.getMeSearches);

router.post("/me/searches", authenticate("customer"), controller.createMeSearches);

router.delete("/me/searches", authenticate("customer"), controller.removeMeSearches);
router.delete("/me/searches/:term", authenticate("customer"), controller.removeMeSearchesById);

router.get("/admin/search", authenticate("admin"), requireAnyPermission(["properties.read", "users.read", "enquiries.read", "acquisitions.read", "sales.read", "visits.read", "support.read", "audit.read"]), validateZod(searchSchema), controller.search);

export default router;
