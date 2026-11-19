import { createController } from "../../utils/controller.factory.js";
import { service } from "./payments.service.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
export const controller = {
  ...createController(service),
  createPaymentsCancel: asyncHandler(async (req, res) => {
    const data = await service.cancel(req.params.paymentId, req.actor, req);
    res.json({ data, meta: { requestId: res.locals.requestId } });
  }),
  updateAdminPaymentsVerify: asyncHandler(async (req, res) => {
    const data = await service.verify(req.params.paymentId, req.body, req.actor, req);
    res.json({ data, meta: { requestId: res.locals.requestId } });
  }),
  recordVerifiedRefund: asyncHandler(async (req, res) => {
    const data = await service.recordVerifiedRefund(req.params.paymentId, req.body, req.actor, req);
    res.status(200).json({ data, meta: { requestId: res.locals.requestId } });
  })
};
