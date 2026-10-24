import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { controller } from "./search.controller.js";
import { searchValidator } from "./search.validation.js";

const router = Router();

router.get("/search/trending", controller.getSearchTrending);

router.get("/me/searches", authenticate("customer"), controller.getMeSearches);

router.post("/me/searches", authenticate("customer"), controller.createMeSearches);

router.delete("/me/searches", authenticate("customer"), controller.removeMeSearches);
router.delete("/me/searches/:term", authenticate("customer"), controller.removeMeSearchesById);

router.get("/admin/search", authenticate("admin"), validate(searchValidator), controller.search);

export default router;
