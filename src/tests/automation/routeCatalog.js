import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const modulesRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../modules");
const missingId = "507f1f77bcf86cd799439011";

const fillParams = (routePath) => routePath.replace(/:([A-Za-z0-9_]+)/g, (match, name) => {
  if (name === "slug") return "missing-content-slug";
  if (name === "term") return "missing-term";
  if (name === "sid") return "missing-session";
  if (name === "entityType") return "property";
  return missingId;
});

const permissionOf = (block) => {
  const single = block.match(/requirePermission\(\s*["']([^"']+)["']\s*\)/);
  if (single) return { mode: "one", values: [single[1]] };
  const list = block.match(/requireAnyPermission\(\s*\[([^\]]+)\]/);
  if (list) {
    const values = [...list[1].matchAll(/["']([^"']+)["']/g)].map((item) => item[1]);
    if (values.length) return { mode: "any", values };
  }
  if (block.includes("requireAnyPermission(") || block.includes("requirePermission(")) return { mode: "dynamic", values: [] };
  return null;
};

export const loadApiCatalog = () => {
  const endpoints = [
    { module: "ops", method: "get", path: "/health", auth: "public", permission: null, validates: false },
    { module: "ops", method: "get", path: "/ready", auth: "public", permission: null, validates: false },
    { module: "ops", method: "get", path: "/metrics", auth: "public", permission: null, validates: false },
    { module: "ops", method: "get", path: "/openapi.json", auth: "public", permission: null, validates: false }
  ];

  for (const moduleName of fs.readdirSync(modulesRoot)) {
    const file = path.join(modulesRoot, moduleName, `${moduleName}.routes.js`);
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, "utf8");
    const pattern = /router\.(get|post|put|patch|delete)\(\s*["'`]([^"'`]+)["'`]/g;
    let match = pattern.exec(text);
    while (match) {
      const next = pattern.exec(text);
      const block = text.slice(match.index, next ? next.index : match.index + 1200);
      const auth = block.includes('authenticate("customer")')
        ? "customer"
        : block.includes('authenticate("admin")')
          ? "admin"
          : /authenticate\(\s*\)/.test(block)
            ? "any"
            : "public";
      const routePath = match[2].startsWith("/") ? match[2] : `/${match[2]}`;
      const prefixes = moduleName === "signin" ? ["/api/signin", "/api/v1/signin"] : ["/api/v1"];
      for (const prefix of prefixes) {
        endpoints.push({
          module: moduleName,
          method: match[1].toLowerCase(),
          path: `${prefix}${routePath}`,
          auth,
          permission: permissionOf(block),
          validates: block.includes("validate(")
        });
      }
      match = next;
    }
  }
  return endpoints.map((endpoint) => ({ ...endpoint, examplePath: fillParams(endpoint.path) }));
};
