import { CITY_POINTS } from "./geo.cities.js";
import { logger } from "../../config/logger.js";

const cache = new Map();
let queue = Promise.resolve();
let lastCallAt = 0;

const finite = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

export const hasCoordinates = (address) => {
  const latitude = finite(address?.latitude);
  const longitude = finite(address?.longitude);
  return latitude != null && longitude != null && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
};

export const addressQuery = (address = {}) =>
  [address.line1, address.line2, address.landmark, address.locality, address.city, address.state, address.pincode, "India"]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(", ");

const point = (latitude, longitude, extra = {}) => ({
  latitude,
  longitude,
  ...extra,
  location: { type: "Point", coordinates: [longitude, latitude] }
});

function cityMatch(query) {
  const text = String(query || "").toLowerCase();
  return CITY_POINTS.find((city) => {
    const name = city.city.toLowerCase();
    return text.includes(name) || (name === "bangalore" && text.includes("bengaluru")) || (name === "delhi" && text.includes("delhi ncr"));
  }) || null;
}

function enqueue(task) {
  const run = queue.then(async () => {
    const wait = Math.max(0, 1100 - (Date.now() - lastCallAt));
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
    lastCallAt = Date.now();
    return task();
  });
  queue = run.then(() => undefined, () => undefined);
  return run;
}

const isCatalogueCenter = (address) => {
  const latitude = finite(address?.latitude);
  const longitude = finite(address?.longitude);
  return CITY_POINTS.some((city) => city.latitude === latitude && city.longitude === longitude);
};

const lookupQueries = (address) => {
  const rows = [
    [address.locality, address.city, address.state, address.pincode, "India"],
    [address.locality, address.city, address.state, "India"],
    [address.pincode, address.city, address.state, "India"],
    [address.line1, address.locality, address.city, address.state, "India"],
    [address.city, address.state, "India"]
  ];
  return [...new Set(rows.map((parts) => parts.map((part) => String(part || "").trim()).filter(Boolean).join(", ")).filter((query) => query.length >= 3 && query !== "India"))];
};

/** Nominatim only. An empty result stays empty so a broader query can be tried next. */
async function nominatimCached(text) {
  const key = `osm:${text.toLowerCase()}`;
  if (cache.has(key)) return cache.get(key);
  if (process.env.NODE_ENV === "test") {
    cache.set(key, null);
    return null;
  }
  const place = await enqueue(() => nominatimSearch(text));
  cache.set(key, place);
  return place;
}

/** Street-level lookup. Tests stay offline and use the catalogue city. */
export async function forwardGeocode(query) {
  const text = String(query || "").trim();
  if (text.length < 3) return null;
  const key = text.toLowerCase();
  if (cache.has(key)) return cache.get(key);
  if (process.env.NODE_ENV === "test") {
    const city = cityMatch(text);
    const place = city ? point(city.latitude, city.longitude, { city: city.city, state: city.state, country: "India" }) : null;
    cache.set(key, place);
    return place;
  }
  const parts = text.split(",").map((part) => part.trim()).filter(Boolean);
  let place = null;
  for (let index = 0; index < parts.length && !place; index += 1) {
    place = await nominatimCached(parts.slice(index).join(", "));
  }
  place = place || cityFallback(text);
  cache.set(key, place);
  return place;
}

async function nominatimSearch(text) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("q", text);
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "1");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Accept-Language": "en",
        "User-Agent": "Builtglory/1.0 (property map)"
      }
    });
    if (!response.ok) return null;
    const rows = await response.json();
    const hit = Array.isArray(rows) ? rows[0] : null;
    const latitude = finite(hit?.lat);
    const longitude = finite(hit?.lon);
    if (latitude == null || longitude == null) return null;
    const address = hit.address || {};
    return point(latitude, longitude, {
      city: address.city || address.town || address.municipality || address.village || "",
      state: address.state || "",
      country: address.country || "India",
      locality: address.suburb || address.neighbourhood || address.city_district || "",
      label: hit.display_name || text
    });
  } catch (error) {
    logger.warn({ event: "forward_geocode_failed", query: text, error: error.message });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function cityFallback(text) {
  const city = cityMatch(text);
  if (!city) return null;
  return point(city.latitude, city.longitude, { city: city.city, state: city.state, country: "India" });
}

/** Fill latitude, longitude and the GeoJSON point used by the map index. */
export async function resolveAddressCoordinates(address, options = {}) {
  if (!address || typeof address !== "object") return address;
  const refine = options.refine && isCatalogueCenter(address) && String(address.locality || address.pincode || "").trim();
  if (hasCoordinates(address) && !refine) {
    const latitude = finite(address.latitude);
    const longitude = finite(address.longitude);
    return { ...address, latitude, longitude, location: { type: "Point", coordinates: [longitude, latitude] } };
  }
  if (process.env.NODE_ENV === "test") return address;
  for (const query of lookupQueries(address)) {
    const place = await nominatimCached(query);
    if (!place) continue;
    return { ...address, latitude: place.latitude, longitude: place.longitude, location: place.location };
  }
  if (hasCoordinates(address)) return address;
  const city = cityMatch(addressQuery(address));
  if (!city) return address;
  return { ...address, ...point(city.latitude, city.longitude) };
}

export async function backfillMissingPropertyCoordinates() {
  if (process.env.NODE_ENV === "test") return 0;
  const { Property } = await import("../properties/properties.model.js");
  const docs = await Property.find({
    isDeleted: { $ne: true },
    $or: [
      { "address.latitude": { $exists: false } },
      { "address.latitude": null },
      { "address.longitude": { $exists: false } },
      { "address.longitude": null },
      ...CITY_POINTS.map((city) => ({ "address.latitude": city.latitude, "address.longitude": city.longitude, "address.locality": { $nin: [null, ""] } }))
    ]
  }).select("address title").limit(200);
  let updated = 0;
  for (const doc of docs) {
    const resolved = await resolveAddressCoordinates(doc.address?.toObject?.() || doc.address || {}, { refine: true });
    if (!hasCoordinates(resolved)) continue;
    doc.set("address.latitude", resolved.latitude);
    doc.set("address.longitude", resolved.longitude);
    doc.set("address.location", resolved.location);
    await doc.save();
    updated += 1;
  }
  logger.info({ event: "property_coordinates_backfill", scanned: docs.length, updated });
  return updated;
}
