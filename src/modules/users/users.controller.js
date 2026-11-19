import { createController } from "../../utils/controller.factory.js";
import { service } from "./users.service.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
export const controller = {
  ...createController(service, { idParam: "userId" }),
  getMe: asyncHandler(async (req, res) => { const data = await service.get(req.actor.id, req.actor); res.json({ data, meta: { requestId: res.locals.requestId } }); }),
  updateMe: asyncHandler(async (req, res) => { const data = await service.update(req.actor.id, req.body, req.actor, req); res.json({ data, meta: { requestId: res.locals.requestId } }); }),
  createMeKyc: asyncHandler(async (req, res) => { const data = await service.submitKyc(req.actor.id, req.body, req.actor, req); res.json({ data, meta: { requestId: res.locals.requestId } }); }),
  putMePushToken: asyncHandler(async (req, res) => { const data = await service.registerPushToken(req.actor.id, req.body, req.actor, req); res.json({ data, meta: { requestId: res.locals.requestId } }); }),
  removeMePushToken: asyncHandler(async (req, res) => { const data = await service.removePushToken(req.actor.id, req.body, req.actor, req); res.json({ data, meta: { requestId: res.locals.requestId } }); }),
  getMeAccountDeletion: asyncHandler(async (req, res) => { const data = await service.getAccountDeletionStatus(req.actor.id); res.json({ data, meta: { requestId: res.locals.requestId } }); }),
  createMeAccountDeletion: asyncHandler(async (req, res) => { const data = await service.requestAccountDeletion(req.actor.id, req.body, req.actor, req); res.status(201).json({ data, meta: { requestId: res.locals.requestId } }); }),
  removeMeAccountDeletion: asyncHandler(async (req, res) => { const data = await service.cancelAccountDeletion(req.actor.id, req.actor, req); res.json({ data, meta: { requestId: res.locals.requestId } }); }),
  getAdminUsersExport: asyncHandler(async (req, res) => { const data = await service.exportProfile(req.params.userId, req.actor); res.json({ data, meta: { requestId: res.locals.requestId } }); }),
  updateAdminUsersById: asyncHandler(async (req, res) => { const data = await service.updateProfile(req.params.userId, req.body, req.actor, req); res.json({ data, meta: { requestId: res.locals.requestId } }); }),
  updateAdminUsersBlock: asyncHandler(async (req, res) => { const data = await service.block(req.params.userId, req.body, req.actor, req); res.json({ data, meta: { requestId: res.locals.requestId } }); }),
  updateAdminUsersAssign: asyncHandler(async (req, res) => { const data = await service.assign(req.params.userId, req.body, req.actor, req); res.json({ data, meta: { requestId: res.locals.requestId } }); }),
  updateAdminUsersKyc: asyncHandler(async (req, res) => { const data = await service.updateKyc(req.params.userId, req.body, req.actor, req); res.json({ data, meta: { requestId: res.locals.requestId } }); }),
  updateAdminUsersFema: asyncHandler(async (req, res) => { const data = await service.updateFema(req.params.userId, req.body, req.actor, req); res.json({ data, meta: { requestId: res.locals.requestId } }); })
};
