import { asyncHandler } from "../../utils/asyncHandler.js";
import { ok, created } from "../../utils/response.js";
import { service } from "./search.service.js";

export const controller = {
  search: asyncHandler(async (req, res) => ok(res, await service.search(req.query, req.actor))),
  getSearchTrending: asyncHandler(async (req, res) => ok(res, await service.trendingSearches(req.query))),
  getMeSearches: asyncHandler(async (req, res) => ok(res, await service.listRecentSearches(req.actor))),
  createMeSearches: asyncHandler(async (req, res) => created(res, await service.recordRecentSearch(req.actor, req.body))),
  removeMeSearches: asyncHandler(async (req, res) => ok(res, req.query.term ? await service.removeRecentSearch(req.actor, req.query.term) : await service.clearRecentSearches(req.actor))),
  removeMeSearchesById: asyncHandler(async (req, res) => ok(res, await service.removeRecentSearch(req.actor, decodeURIComponent(req.params.term))))
};
