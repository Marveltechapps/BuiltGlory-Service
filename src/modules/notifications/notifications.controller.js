import { createController } from "../../utils/controller.factory.js";
import { service } from "./notifications.service.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
export const controller = {
  ...createController(service),
  getMeNotificationsUnreadCount: asyncHandler(async (req, res) => {
      const data = await service.countUnread(req.actor);
      res.json({ data, meta: { requestId: res.locals.requestId } });
    }),
  updateMeNotificationsRead: asyncHandler(async (req, res) => {
      const data = await service.markMineRead(req.actor, req.body.ids || []);
      res.json({ data, meta: { requestId: res.locals.requestId } });
    }),
  updateMeNotificationReadById: asyncHandler(async (req, res) => {
      const data = await service.markOneRead(req.params.id, req.actor);
      res.json({ data, meta: { requestId: res.locals.requestId } });
    }),
  removeMeNotificationsById: asyncHandler(async (req, res) => {
      const data = await service.deleteMine(req.params.id, req.actor);
      res.json({ data, meta: { requestId: res.locals.requestId } });
    }),
  createAdminNotificationsPush: asyncHandler(async (req, res) => {
      const data = await import("./notifications.service.js").then((m) => m.service.sendManual(req.body, req.actor, req));
      res.status(201).json({ data, meta: { requestId: res.locals.requestId } });
    }),
  createAdminNotificationsRetry: asyncHandler(async (req, res) => {
      const data = await import("./notifications.service.js").then((m) => m.service.retry(req.params.id, req.actor, req));
      res.json({ data, meta: { requestId: res.locals.requestId } });
    })
};
