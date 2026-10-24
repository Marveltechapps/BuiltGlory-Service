import { createController } from "../../utils/controller.factory.js";
import { service } from "./buyEnquiries.service.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
export const controller = {
  ...createController(service, { idParam: "enquiryId" }),
  updateMeBuyEnquiriesCancel: asyncHandler(async (req, res) => { const data = await service.cancel(req.params.enquiryId, req.actor, req, req.body || {}); res.json({ data, meta: { requestId: res.locals.requestId } }); }),
  createAdminBuyEnquiriesConvertToDeal: asyncHandler(async (req, res) => {
    const result = await service.convertToDeal(req.params.enquiryId, req.body || {}, req.actor);
    res.status(result.created ? 201 : 200).json({ data: result.deal, meta: { requestId: res.locals.requestId } });
  })
};
