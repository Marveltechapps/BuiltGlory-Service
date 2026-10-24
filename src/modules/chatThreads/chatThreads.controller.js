import { createController } from "../../utils/controller.factory.js";
import { service } from "./chatThreads.service.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
export const controller = {
  ...createController(service, { idParam: "threadId" }),
  createAdminNegotiationsChatsMessages: asyncHandler(async (req, res) => {
    const data = await service.addMessage(req.params.threadId, req.body, req.actor, req);
    res.status(201).json({ data, meta: { requestId: res.locals.requestId } });
  }),
  updateAdminNegotiationsChatsOffersById: asyncHandler(async (req, res) => {
    const data = await service.respondToOffer(req.params.threadId, req.params.messageId, req.body, req.actor, req);
    res.json({ data, meta: { requestId: res.locals.requestId } });
  })
};
