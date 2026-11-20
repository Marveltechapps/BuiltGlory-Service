import { ok } from "../../utils/response.js";
import { domainError } from "./geo.error.js";
import { reversePlace } from "./geo.addressLookup.js";
import { forwardGeocode } from "./geo.coordinates.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
export const controller = {
  getGeoReverse: asyncHandler(async (req, res) => {
    const latitude = Number(req.query.latitude);
    const longitude = Number(req.query.longitude);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      throw domainError("A valid latitude and longitude are required.");
    }
    ok(res, await reversePlace(latitude, longitude));
  }),
  getGeoForward: asyncHandler(async (req, res) => {
    const query = String(req.query.q || req.query.query || "").trim();
    if (query.length < 3) throw domainError("Enter an address or place to look up.");
    const place = await forwardGeocode(query);
    if (!place) throw domainError("No map location was found for that address.");
    ok(res, { ...place, query });
  })
};
