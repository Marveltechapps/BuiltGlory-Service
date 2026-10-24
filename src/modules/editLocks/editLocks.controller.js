import { ok } from "../../utils/response.js";
import { service } from "./editLocks.service.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
export const controller = {
  getAdminWorkflowLock: asyncHandler(async (req, res) => {
    ok(res, await service.get(req.params.entityType, req.params.entityId, req.actor));
  }),
  createAdminWorkflowLock: asyncHandler(async (req, res) => {
    ok(res, await service.claim(req.params.entityType, req.params.entityId, req.actor, req.body));
  }),
  removeAdminWorkflowLock: asyncHandler(async (req, res) => {
    ok(res, await service.release(req.params.entityType, req.params.entityId, req.actor));
  })
};
