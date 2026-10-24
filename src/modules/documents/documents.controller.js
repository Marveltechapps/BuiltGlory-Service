import { createController } from "../../utils/controller.factory.js";
import { service } from "./documents.service.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
export const controller = {
  ...createController(service),
  createDocumentsUploadIntents: asyncHandler(async (req, res) => {
    const data = await service.create({ ...req.body, createSignedUrl: true }, req.actor);
    res.status(201).json({ data, meta: { requestId: res.locals.requestId } });
  }),
  createDocuments: asyncHandler(async (req, res) => {
    const data = await service.createFromMultipart({ file: req.file, body: req.body }, req.actor);
    res.status(201).json({ data, meta: { requestId: res.locals.requestId } });
  }),
  getDocumentsReadUrl: asyncHandler(async (req, res) => {
    const data = await service.createSecureReadUrl(req.params.documentId, req.actor, req.query);
    res.json({ data, meta: { requestId: res.locals.requestId } });
  })
};
