import { Router } from "express";
import { asyncHandler } from "../../shared/asyncHandler.js";
import { ok } from "../../shared/response.js";
import { domainError } from "../../shared/errors/AppError.js";
import { reversePlace } from "./addressLookup.js";

const router = Router();
router.get("/geo/reverse", asyncHandler(async (req, res) => {
  const latitude = Number(req.query.latitude);
  const longitude = Number(req.query.longitude);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw domainError("A valid latitude and longitude are required.");
  }
  ok(res, await reversePlace(latitude, longitude));
}));
export default router;
