import { nearestCity } from "./geo.cities.js";

const cleanLocality = (value) => String(value || "").replace(/^Zone\s+\d+\s+/i, "").trim();

/** Street, area and pincode for a map point. Falls back to the nearest catalogue city. */
export async function reversePlace(latitude, longitude) {
  const nearest = nearestCity(latitude, longitude);
  if (process.env.NODE_ENV === "test") return nearest;
  try {
    const details = await nominatim(latitude, longitude);
    return {
      ...nearest,
      city: details.city || nearest.city,
      state: details.state || nearest.state,
      country: details.country || nearest.country,
      ...(details.street ? { street: details.street } : {}),
      ...(details.locality ? { locality: details.locality } : {}),
      ...(details.pincode ? { pincode: details.pincode } : {})
    };
  } catch {
    return nearest;
  }
}

async function nominatim(latitude, longitude) {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("zoom", "18");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Accept-Language": "en",
        "User-Agent": "Builtglory/1.0 (location autofill)"
      }
    });
    if (!response.ok) throw new Error("Geocoder unavailable");
    const body = await response.json();
    return parseAddress(body.address || {});
  } finally {
    clearTimeout(timer);
  }
}

function parseAddress(address) {
  const street = [address.house_number, address.road || address.pedestrian].filter(Boolean).join(" ").trim();
  const locality = [address.suburb, address.neighbourhood, address.quarter, address.city_district]
    .map(cleanLocality)
    .find(Boolean) || "";
  const city = address.city || address.town || address.municipality || address.village || "";
  const digits = String(address.postcode || "").replace(/\D/g, "");
  return {
    street,
    locality,
    city,
    state: address.state || "",
    country: address.country || "India",
    pincode: digits.length === 6 ? digits : ""
  };
}
