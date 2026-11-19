import { AuditLog } from "../modules/auditLogs/auditLogs.model.js";

/** Paths that must never appear in audit before/after payloads (G-02 / §13.5). */
export const AUDIT_REDACT_PATHS = [
  "passwordHash",
  "otp",
  "otpExpiry",
  "bankDetails",
  "kycDocuments",
  "pushDevices",
  "notificationPreferences.unsubscribeToken",
  "gatewaySignature",
  "providerResponse",
  "fileContent",
  "downloadToken",
  "downloadTokenHash",
  "otpHash",
  "salt"
];

const isPlainObject = (value) => value != null && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date) && !(value?.constructor?.name === "ObjectId");

/** Leaf key names that are redacted at ANY nesting depth (e.g. `payload.user.passwordHash`). */
export const AUDIT_SENSITIVE_LEAF_KEYS = new Set([
  "passwordHash",
  "otp",
  "otpExpiry",
  "bankDetails",
  "gatewaySignature",
  "providerResponse",
  "fileContent",
  "downloadToken",
  "downloadTokenHash",
  "otpHash",
  "salt",
  "unsubscribeToken",
  "pushDevices",
  "kycDocuments"
]);

const pathMatches = (path, redactPath) => path === redactPath || path.startsWith(`${redactPath}.`);

const leafKeyOf = (path) => {
  const index = path.lastIndexOf(".");
  return index === -1 ? path : path.slice(index + 1);
};

const redactValue = (value, path = "") => {
  if (AUDIT_REDACT_PATHS.some((redactPath) => pathMatches(path, redactPath))) return "[redacted]";
  if (path && AUDIT_SENSITIVE_LEAF_KEYS.has(leafKeyOf(path))) return "[redacted]";
  if (Array.isArray(value)) {
    return value.map((item, index) => redactValue(item, path ? `${path}.${index}` : String(index)));
  }
  if (!isPlainObject(value)) {
    if (value && typeof value.toObject === "function") return redactValue(value.toObject(), path);
    return value;
  }
  const out = {};
  for (const [key, child] of Object.entries(value)) {
    const childPath = path ? `${path}.${key}` : key;
    out[key] = redactValue(child, childPath);
  }
  return out;
};

/**
 * Keep only changed paths when both before and after are objects; always redact.
 * Sensitive keys are compared on the unredacted values so a secret change still
 * appears in the diff (as "[redacted]"), without leaking the raw value.
 */
export const buildAuditDiff = (before, after) => {
  const redactedBefore = before == null ? before : redactValue(before);
  const redactedAfter = after == null ? after : redactValue(after);

  if (!isPlainObject(before) || !isPlainObject(after) || !isPlainObject(redactedBefore) || !isPlainObject(redactedAfter)) {
    return { before: redactedBefore ?? null, after: redactedAfter ?? null, changedFields: [] };
  }

  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const beforeDiff = {};
  const afterDiff = {};
  const changedFields = [];

  for (const key of keys) {
    const rawLeft = before[key];
    const rawRight = after[key];
    if (JSON.stringify(rawLeft) === JSON.stringify(rawRight)) continue;
    changedFields.push(key);
    if (key in redactedBefore) beforeDiff[key] = redactedBefore[key];
    if (key in redactedAfter) afterDiff[key] = redactedAfter[key];
  }

  return {
    before: Object.keys(beforeDiff).length ? beforeDiff : null,
    after: Object.keys(afterDiff).length ? afterDiff : null,
    changedFields
  };
};

export const writeAuditLog = async ({ actor, action, resourceType, resourceId, resourceReferenceId, description, actorName, before, after, req, requestId }, options = {}) => {
  if (!actor || !["admin", "customer", "system"].includes(actor.type)) return null;
  const diff = buildAuditDiff(before, after);
  return AuditLog.create([{
    actorType: actor.type,
    actorId: actor.id,
    actorName: actorName || actor.name || undefined,
    action,
    description,
    resourceType,
    resourceId,
    resourceReferenceId,
    changedFields: diff.changedFields,
    before: diff.before,
    after: diff.after,
    requestId: requestId || req?.requestId || req?.id,
    ipAddress: req?.ip,
    userAgent: req?.headers?.["user-agent"]
  }], options).then((r) => r[0]);
};
