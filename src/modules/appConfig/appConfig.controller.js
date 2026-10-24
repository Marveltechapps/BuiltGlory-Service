import { asyncHandler } from "../../utils/asyncHandler.js";
import { ok } from "../../utils/response.js";
import { service } from "./appConfig.service.js";

export const controller = {
  getPublicConfig: asyncHandler(async (req, res) => {
    ok(res, await service.getPublicConfig());
  })
};
