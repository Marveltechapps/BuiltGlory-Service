// QA: every API path called by the Customer App, Webapp and Admin Dashboard must exist on the backend.
// Static extraction from client source; matches HTTP method + path pattern against the mounted routers.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadApiCatalog } from "../automation/routeCatalog.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
// Only the API layer is scanned; page/navigation routes (router links) are not API calls.
const clients = {
  "Customer App": ["services", "api"].map((d) => path.join(root, "BG-Customer App", "src", d)),
  Webapp: ["services", "lib"].map((d) => path.join(root, "BG-Webapp", "src", d)),
  Dashboard: ["services", "lib", "hooks"].map((d) => path.join(root, "BG-Dashboard-Frontend", "src", d))
};
const stripComments = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const walk = (dir) => fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(dir, e.name);
  if (e.isDirectory()) return e.name === "node_modules" || e.name === "__tests__" ? [] : walk(p);
  return /\.(ts|tsx|js|jsx)$/.test(e.name) ? [p] : [];
}) : [];

const toPattern = (raw) => {
  let p = raw.split("?")[0].replace(/\$\{[^}]*\}/g, ":p").replace(/\/+$/, "");
  p = p.replace(/^\/?(api\/)?(v1\/)?/, "/");
  return p;
};

const backend = loadApiCatalog()
  .filter((e) => e.path.startsWith("/api/v1"))
  .map((e) => ({ method: e.method, re: new RegExp("^" + e.path.replace("/api/v1", "").replace(/:[A-Za-z0-9_]+/g, "[^/]+") + "$"), path: e.path }));

const extract = (file) => {
  const text = stripComments(fs.readFileSync(file, "utf8"));
  const calls = [];
  // String / template literals that look like API paths.
  const re = /[`'"]((?:\/api)?(?:\/v1)?\/(?:me|admin|auth|properties|property|buy-enquiries|sell-requests|visits|payments|uploads|documents|notifications|search|support|support-tickets|callbacks|chat|chat-threads|content|app-config|app|geo|locations|boost|boost-orders|interior-leads|feedback|app-feedback|edit-locks|reports|communication-logs|signin)(?:[/][^`'"\s]*)?)[`'"]/g;
  let m;
  while ((m = re.exec(text))) {
    const before = text.slice(Math.max(0, m.index - 220), m.index);
    const after = text.slice(m.index, m.index + 260);
    // Skip UI navigation links (`route: '/admin/...'`) and Socket.IO namespaces (`io('/chat')`).
    if (/route:\s*$/.test(before) || /\bio\(\s*(?:[^,)]*\?\s*)?(?:`[^`]*`\s*:\s*)?$/.test(before) || m[1] === "/chat") continue;
    const methodMatch = (after.match(/method:\s*['"`](GET|POST|PUT|PATCH|DELETE)['"`]/i) || before.match(/\.(get|post|put|patch|delete)\s*(?:<[^>]*>)?\(\s*$/i) || before.match(/\b(get|post|put|patch|delete)\w*\s*(?:<[^>]*>)?\(\s*$/i));
    calls.push({ raw: m[1], pattern: toPattern(m[1]), method: methodMatch ? methodMatch[1].toLowerCase() : null, line: text.slice(0, m.index).split("\n").length });
  }
  return calls;
};

const results = {};
for (const [name, dirs] of Object.entries(clients)) {
  const rows = [];
  for (const file of dirs.flatMap(walk)) for (const c of extract(file)) {
    // A template that ends right after an interpolation and is then concatenated is a prefix fragment.
    if (/\$\{[^}]*\}$/.test(c.raw) && /:p\/:p$/.test(c.pattern)) continue;
    if (c.pattern === "/" || c.pattern.split("/").length < 2) continue;
    const pathMatches = backend.filter((b) => b.re.test(c.pattern.replace(/:p/g, "x")));
    const methodOk = !c.method || pathMatches.some((b) => b.method === c.method);
    rows.push({ ...c, file: path.relative(root, file).replace(/\\/g, "/"), pathExists: pathMatches.length > 0, methodOk });
  }
  results[name] = rows;
}

describe("Client → backend API contract", () => {
  for (const name of Object.keys(clients)) {
    test(`${name}: every referenced endpoint path exists on the backend`, () => {
      const rows = results[name];
      const missing = rows.filter((r) => !r.pathExists);
      const unique = [...new Map(missing.map((r) => [r.pattern, r])).values()].map((r) => `${r.method || "?"} ${r.pattern}  (${r.file}:${r.line})`);
      console.log(`QA_CONTRACT ${name} referenced=${rows.length} missing=${unique.length}\n` + unique.join("\n"));
      expect(rows.length).toBeGreaterThan(0);
      expect(unique).toEqual([]);
    });
  }
});
