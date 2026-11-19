/**
 * Backfill users.stats.* from the deprecated top-level counters, and users.location (GeoJSON Point) from
 * latitude / longitude when location is missing.
 *
 * Idempotent: only touches users whose target field is missing. Never overwrites existing stats/location values.
 * Does not touch the top-level counters or latitude/longitude (they stay readable for old clients).
 */
const STAT_KEYS = ["totalEnquiries", "totalVisits", "totalDeals", "totalListings"];

export const up = async () => {
  const mongoose = (await import("mongoose")).default;
  const db = mongoose.connection.db;
  const summary = { stats: {}, location: 0 };

  if (!(await db.listCollections({ name: "users" }).hasNext())) return { skipped: "users collection missing" };
  const users = db.collection("users");

  for (const key of STAT_KEYS) {
    const res = await users.updateMany(
      {
        [key]: { $type: "number" },
        $or: [{ [`stats.${key}`]: { $exists: false } }, { [`stats.${key}`]: null }]
      },
      [{ $set: { [`stats.${key}`]: `$${key}` } }]
    );
    summary.stats[key] = res.modifiedCount;
  }

  // location missing (or present but without coordinates) + valid lat/lng => GeoJSON [lng, lat].
  const res = await users.updateMany(
    {
      latitude: { $type: "number", $gte: -90, $lte: 90 },
      longitude: { $type: "number", $gte: -180, $lte: 180 },
      $or: [
        { location: { $exists: false } },
        { location: null },
        { "location.coordinates.0": { $exists: false } }
      ]
    },
    [{ $set: { location: { type: "Point", coordinates: ["$longitude", "$latitude"] } } }]
  );
  summary.location = res.modifiedCount;

  return summary;
};
