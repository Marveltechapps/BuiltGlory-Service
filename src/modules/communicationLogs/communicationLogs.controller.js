import { asyncHandler } from "../../utils/asyncHandler.js";
import { ok, created } from "../../utils/response.js";
import { service } from "./communicationLogs.service.js";

export const controller = {
  create: asyncHandler(async (req, res) => {
    created(res, await service.create(req.body, req.actor, req));
  }),
  timeline: asyncHandler(async (req, res) => {
    const result = await service.timeline({ ...req.params, query: req.query }, req.actor);
    ok(res, result.data, result.meta);
  }),
  getAdminWorkflowLogs: asyncHandler(async (req, res) => {
    const result = await service.timeline({ entityType: req.params.entityType, entityId: req.params.entityId, query: req.query }, req.actor);
    ok(res, result.data, result.meta);
  }),
  getAdminTimeline: asyncHandler(async (req, res) => {
    const result = await service.timeline({ entityType: req.params.entityType, entityId: req.params.entityId, query: req.query }, req.actor);
    ok(res, result.data, result.meta);
  }),
  getAdminCommunicationLogs: asyncHandler(async (req, res) => {
    const result = await service.list(req.query, req.actor);
    ok(res, result.data, result.meta);
  }),
  createAdminCommunicationLogs: asyncHandler(async (req, res) => {
    created(res, await service.create(req.body, req.actor, req));
  }),
  createAdminWorkflowLogs: asyncHandler(async (req, res) => {
    const data = await service.createForEntity({ entityType: req.params.entityType, entityId: req.params.entityId, body: req.body }, req.actor, req);
    created(res, data);
  }),
  createAdminWorkflowPush: asyncHandler(async (req, res) => {
    const data = await service.sendPush({ entityType: req.params.entityType, entityId: req.params.entityId, body: req.body }, req.actor, req);
    created(res, data);
  }),
  createAdminWorkflowEmail: asyncHandler(async (req, res) => {
    const data = await service.sendEmail({ entityType: req.params.entityType, entityId: req.params.entityId, body: req.body }, req.actor, req);
    created(res, data);
  }),
  createAdminWorkflowProofs: asyncHandler(async (req, res) => {
    const data = await service.createProofUpload({ entityType: req.params.entityType, entityId: req.params.entityId, file: req.file, body: req.body }, req.actor, req);
    created(res, data);
  }),
  removeAdminWorkflowLogsById: asyncHandler(async (req, res) => {
    ok(res, await service.remove(req.params.logId, req.actor, req));
  })
};
