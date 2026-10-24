import { createController } from "../../utils/controller.factory.js";
import { service } from "./acquisitions.service.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
export const controller = {
  ...createController(service, { idParam: "acquisitionId" }),
  createAdminAcquisitionsConvertToProperty: asyncHandler(async (req, res) => {
    const { service } = await import("./acquisitions.service.js");
    const data = await service.convertToProperty(req.params.acquisitionId, req.body || {}, req.actor, req);
    res.status(201).json({ data, meta: { requestId: res.locals.requestId } });
  })
};
