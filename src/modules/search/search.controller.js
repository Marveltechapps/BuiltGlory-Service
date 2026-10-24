import { asyncHandler } from "../../utils/asyncHandler.js";
import { ok } from "../../utils/response.js";
import { service } from "./search.service.js";

export const controller = {
  search: asyncHandler(async (req, res) => ok(res, await service.search(req.query, req.actor)))
};
