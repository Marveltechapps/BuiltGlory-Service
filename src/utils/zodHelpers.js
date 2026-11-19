import { z } from "zod";

/**
 * Boolean coerce that treats the strings "false" / "0" as false.
 * z.coerce.boolean() uses Boolean(value), so any non-empty string becomes true (QA-BUG-007).
 */
export const booleanish = z.preprocess((value) => {
  if (value === true || value === "true" || value === "1" || value === 1) return true;
  if (value === false || value === "false" || value === "0" || value === 0) return false;
  return value;
}, z.boolean());
