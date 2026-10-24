import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ok } from "../../utils/response.js";
import { service } from "./editLocks.service.js";
import { lockParamsValidator, lockValidator } from "./editLocks.validation.js";

const router = Router();

router.get("/admin/workflow/:entityType/:entityId/lock", authenticate("admin"), validate(lockParamsValidator), asyncHandler(async (req, res) => {
  ok(res, await service.get(req.params.entityType, req.params.entityId, req.actor));
}));

router.post("/admin/workflow/:entityType/:entityId/lock", authenticate("admin"), validate(lockValidator), asyncHandler(async (req, res) => {
  ok(res, await service.claim(req.params.entityType, req.params.entityId, req.actor, req.body));
}));

router.delete("/admin/workflow/:entityType/:entityId/lock", authenticate("admin"), validate(lockParamsValidator), asyncHandler(async (req, res) => {
  ok(res, await service.release(req.params.entityType, req.params.entityId, req.actor));
}));

export default router;
