import { createController } from "../../utils/controller.factory.js";
import { service } from "./callbacks.service.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
export const controller = {
  ...createController(service, { idParam: "callbackId" }),
  createAdminCallbacksAttempts: asyncHandler(async (req, res) => {
    const data = await service.addAttempt(req.params.callbackId, req.body, req.actor, req);
    res.status(201).json({ data, meta: { requestId: res.locals.requestId } });
  }),
  updateAdminCallbacksResolve: asyncHandler(async (req, res) => {
    const data = await service.transition(req.params.callbackId, "resolved", req.actor, req, req.body || {});
    res.json({ data, meta: { requestId: res.locals.requestId } });
  }),
  updateAdminCallbacksReschedule: asyncHandler(async (req, res) => {
    const data = await service.transition(req.params.callbackId, "rescheduled", req.actor, req, req.body || {});
    res.json({ data, meta: { requestId: res.locals.requestId } });
  })
};
