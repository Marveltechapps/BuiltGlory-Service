import { createController } from "../../utils/controller.factory.js";
import { service } from "./supportTickets.service.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { publishSupportTicket } from "../../realtime/chatSocket.js";
export const controller = {
  ...createController(service, { idParam: "ticketId" }),
  createMeSupportTicketsResponses: asyncHandler(async (req, res) => {
      const data = await service.addResponse(req.params.ticketId, req.body, req.actor, req);
      publishSupportTicket(data);
      res.status(201).json({ data, meta: { requestId: res.locals.requestId } });
    }),
  createAdminSupportTicketsResponses: asyncHandler(async (req, res) => {
      const data = await service.addResponse(req.params.ticketId, req.body, req.actor, req);
      publishSupportTicket(data);
      res.status(201).json({ data, meta: { requestId: res.locals.requestId } });
    }),
  getMeSupportLiveChat: asyncHandler(async (req, res) => {
    const data = await service.getActiveLiveChat(req.actor);
    res.json({ data, meta: { requestId: res.locals.requestId } });
  }),
  createMeSupportLiveChat: asyncHandler(async (req, res) => {
    const data = await service.startLiveChat(req.body || {}, req.actor);
    publishSupportTicket(data);
    res.status(201).json({ data, meta: { requestId: res.locals.requestId } });
  }),
  createMeSupportTicketsRead: asyncHandler(async (req, res) => {
    const data = await service.markRead(req.params.ticketId, req.actor);
    publishSupportTicket(data);
    res.json({ data, meta: { requestId: res.locals.requestId } });
  }),
  createMeSupportTicketsClose: asyncHandler(async (req, res) => {
    const data = await service.closeChat(req.params.ticketId, req.actor, req);
    publishSupportTicket(data);
    res.json({ data, meta: { requestId: res.locals.requestId } });
  }),
  createMeSupportTicketsReopen: asyncHandler(async (req, res) => {
    const data = await service.reopenChat(req.params.ticketId, req.actor, req);
    publishSupportTicket(data);
    res.json({ data, meta: { requestId: res.locals.requestId } });
  }),
  createAdminSupportTicketsRead: asyncHandler(async (req, res) => {
    const data = await service.markRead(req.params.ticketId, req.actor);
    publishSupportTicket(data);
    res.json({ data, meta: { requestId: res.locals.requestId } });
  }),
  createAdminSupportTicketsClose: asyncHandler(async (req, res) => {
    const data = await service.closeChat(req.params.ticketId, req.actor, req);
    publishSupportTicket(data);
    res.json({ data, meta: { requestId: res.locals.requestId } });
  }),
  createAdminSupportTicketsReopen: asyncHandler(async (req, res) => {
    const data = await service.reopenChat(req.params.ticketId, req.actor, req);
    publishSupportTicket(data);
    res.json({ data, meta: { requestId: res.locals.requestId } });
  })
};
