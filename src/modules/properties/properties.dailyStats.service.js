import { PropertyDailyStat } from "./properties.dailyStat.model.js";

/** Calendar day at 00:00 Asia/Kolkata, stored as a UTC Date. */
export const istDayStart = (when = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(when);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  // IST is UTC+5:30 → midnight IST == previous day 18:30 UTC
  return new Date(`${year}-${month}-${day}T00:00:00+05:30`);
};

export const incrementPropertyDailyStat = async (propertyId, field, by = 1) => {
  if (!propertyId || !field) return null;
  const date = istDayStart();
  try {
    return await PropertyDailyStat.findOneAndUpdate(
      { propertyId, date },
      { $inc: { [field]: by }, $setOnInsert: { propertyId, date } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } catch {
    return null;
  }
};

export const sumPropertyDailyStats = async (propertyId, days = 7) => {
  const since = istDayStart(new Date(Date.now() - (days - 1) * 86400000));
  const rows = await PropertyDailyStat.find({ propertyId, date: { $gte: since } }).lean();
  return rows.reduce(
    (acc, row) => {
      acc.views += row.views || 0;
      acc.enquiries += row.enquiries || 0;
      acc.visits += row.visits || 0;
      acc.saves += row.saves || 0;
      return acc;
    },
    { views: 0, enquiries: 0, visits: 0, saves: 0 }
  );
};
