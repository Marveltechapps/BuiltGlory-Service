import { asyncHandler } from "../../utils/asyncHandler.js";
import { ok, created } from "../../utils/response.js";
import { service } from "./communicationLogs.service.js";

export const controller = {
  create: asyncHandler(async (req, res) => {
    created(res, await service.create(req.body, req.actor, req));
  }),
  timeline: asyncHandler(async (req, res) => {
    const result = await service.timeline({ ...req.params, query: req.query }, req.actor);
    ok(res, result.data, result.meta);
  })
};
