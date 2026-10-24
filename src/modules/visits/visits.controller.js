import { createController } from "../../utils/controller.factory.js";
import { service } from "./visits.service.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
export const controller = {
  ...createController(service, { idParam: "visitId" }),
  getMeVisits: asyncHandler(async (req, res) => {
    const result = await service.listMine(req.actor, req.query);
    res.json({ data: result.data, meta: { ...result.meta, requestId: res.locals.requestId } });
  }),
  getVisitsAvailability: asyncHandler(async (req, res) => {
    const data = await service.availability(req.query, req.actor);
    res.json({ data, meta: { requestId: res.locals.requestId } });
  }),
  updateVisitsReschedule: asyncHandler(async (req, res) => {
    const data = await service.transition(req.params.visitId, "rescheduled", req.actor, req, req.body || {});
    res.json({ data, meta: { requestId: res.locals.requestId } });
  }),
  updateVisitsCancel: asyncHandler(async (req, res) => {
    const data = await service.transition(req.params.visitId, "cancelled", req.actor, req, req.body || {});
    res.json({ data, meta: { requestId: res.locals.requestId } });
  })
};
