// `$` keys are Mongo operators. Dots are path syntax, so they are rewritten to a
// fullwidth dot instead of being dropped — custom document names like "Sale.Deed" survive.
const safeKey = (key) => {
  if (key.startsWith("$")) return null;
  return key.includes(".") ? key.replaceAll(".", "\uFF0E") : key;
};

const sanitizeValue = (value) => {
  if (!value || typeof value !== "object") return value;
  if (Buffer.isBuffer(value) || ArrayBuffer.isView(value)) return value;
  if (Array.isArray(value)) return value.map(sanitizeValue);
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, nested]) => [safeKey(key), nested])
      .filter(([key]) => key)
      .map(([key, nested]) => [key, sanitizeValue(nested)])
  );
};

const mutateSanitized = (target) => {
  if (!target || typeof target !== "object") return;
  if (Buffer.isBuffer(target) || ArrayBuffer.isView(target)) return;
  const sanitized = sanitizeValue(target);
  for (const key of Object.keys(target)) delete target[key];
  Object.assign(target, sanitized);
};

export const mongoSanitize = (req, res, next) => {
  mutateSanitized(req.body);
  mutateSanitized(req.query);
  mutateSanitized(req.params);
  next();
};
