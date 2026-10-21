const LOCAL_DEV_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

const listedOrigins = (raw) => String(raw || "")
  .split(",")
  .map((item) => item.trim())
  .filter((item) => item && item !== "*");

/**
 * Credentialed CORS allow-list.
 * Production uses only the configured origins. `*` is never allowed.
 * Development and test also allow localhost and 127.0.0.1 on any port, so a
 * Vite fallback port still reaches the API.
 */
export const corsOriginOption = (raw, nodeEnv = "development") => {
  const listed = listedOrigins(raw);
  const allowLocalDev = nodeEnv !== "production";
  if (!listed.length) return allowLocalDev ? true : false;
  if (!allowLocalDev) return listed;
  return (origin, callback) => {
    const allowed = !origin || listed.includes(origin) || LOCAL_DEV_ORIGIN.test(origin);
    callback(null, allowed);
  };
};
