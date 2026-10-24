import { asyncHandler } from "../../utils/asyncHandler.js";
import { ok } from "../../utils/response.js";
import { service } from "./adminSettings.service.js";

export const controller = {
  get: asyncHandler(async (req, res) => {
    ok(res, await service.get());
  }),
  update: asyncHandler(async (req, res) => {
    ok(res, await service.update(req.body, req.actor, req));
  })
};
