import { asyncHandler } from "../../shared/asyncHandler.js";
import * as service from "./service.js";

const normalizeOtpBody = (body) => ({ ...body, mobileNumber: body.mobileNumber || body.phone });

const respond = (handler) => asyncHandler(async (req, res) => {
  res.status(200).json(await handler(normalizeOtpBody(req.body)));
});

export const controller = {
  sendOtp: respond(service.sendOtp),
  verifyOtp: respond(service.verifyOtp),
  resendOtp: respond(service.resendOtp)
};
