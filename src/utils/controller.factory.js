import { asyncHandler } from "./asyncHandler.js";
import { ok, created, noContent } from "./response.js";
// idParam names the route parameter that carries the resource id, e.g. "enquiryId" for /buy-enquiries/:enquiryId.
export const createController = (service, { idParam = "id" } = {}) => {
  const resourceId = (req) => req.params[idParam];
  return {
    list: asyncHandler(async (req, res) => { const result = await service.list(req.query, req.actor); ok(res, result.data, result.meta); }),
    mine: asyncHandler(async (req, res) => { const result = await service.list(req.query, req.actor); ok(res, result.data, result.meta); }),
    get: asyncHandler(async (req, res) => ok(res, await service.get(resourceId(req), req.actor))),
    create: asyncHandler(async (req, res) => created(res, await service.create(req.body, req.actor))),
    update: asyncHandler(async (req, res) => ok(res, await service.update(resourceId(req), req.body, req.actor, req))),
    remove: asyncHandler(async (req, res) => { await service.remove(resourceId(req), req.actor, req); noContent(res); }),
    transition: (field) => asyncHandler(async (req, res) => ok(res, await service.transition(resourceId(req), req.body[field] || req.body.status || req.body.stage || req.body.decision, req.actor, req, req.body)))
  };
};
