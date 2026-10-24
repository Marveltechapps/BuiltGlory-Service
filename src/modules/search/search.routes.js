import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { created, ok } from "../../utils/response.js";
import { controller } from "./search.controller.js";
import { service } from "./search.service.js";
import { searchValidator } from "./search.validation.js";

const router = Router();

router.get("/search/trending", asyncHandler(async (req, res) => ok(res, await service.trendingSearches(req.query))));

router.get("/me/searches", authenticate("customer"), asyncHandler(async (req, res) => ok(res, await service.listRecentSearches(req.actor))));

router.post("/me/searches", authenticate("customer"), asyncHandler(async (req, res) => created(res, await service.recordRecentSearch(req.actor, req.body))));

router.delete("/me/searches", authenticate("customer"), asyncHandler(async (req, res) => ok(res, req.query.term ? await service.removeRecentSearch(req.actor, req.query.term) : await service.clearRecentSearches(req.actor))));
router.delete("/me/searches/:term", authenticate("customer"), asyncHandler(async (req, res) => ok(res, await service.removeRecentSearch(req.actor, decodeURIComponent(req.params.term)))));

router.get("/admin/search", authenticate("admin"), validate(searchValidator), controller.search);

export default router;
