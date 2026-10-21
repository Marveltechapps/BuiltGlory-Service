const IST_OFFSET_MINUTES = 5 * 60 + 30;

export const dateKey = (value) => {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value || "").slice(0, 10);
};

export const normalizeSlot = (value) => String(value || "").trim().replace(/\s+/g, " ").toUpperCase();

/** Interpret a calendar date plus a wall-clock slot as Asia/Kolkata, not UTC. */
export const visitDateTime = (data) => {
  const [year, month, day] = dateKey(data.visitDate).split("-").map(Number);
  const match = normalizeSlot(data.visitTime || "00:00").match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/);
  let hour = match ? Number(match[1]) : 0;
  const minute = match?.[2] ? Number(match[2]) : 0;
  const meridiem = match?.[3];
  if (meridiem === "PM" && hour < 12) hour += 12;
  if (meridiem === "AM" && hour === 12) hour = 0;
  return new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0) - IST_OFFSET_MINUTES * 60 * 1000);
};
