/**
 * Rewrites route files: validate(xValidator) → validateZod(xSchema)
 * and updates imports from *.validation.js → *.schemas.js where schemas exist.
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve("src/modules");
const modules = fs.readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);

let rewritten = 0;
for (const name of modules) {
  const dir = path.join(root, name);
  const schemasPath = path.join(dir, `${name}.schemas.js`);
  const routesPath = path.join(dir, `${name}.routes.js`);
  if (!fs.existsSync(schemasPath) || !fs.existsSync(routesPath)) continue;

  let text = fs.readFileSync(routesPath, "utf8");
  const before = text;
  text = text.replace(/from\s+["']\.\/[^"']*\.validation\.js["']/g, (m) => m.replace(".validation.js", ".schemas.js"));
  text = text.replace(/from\s+["']\.\.\/\.\.\/middleware\/validate\.js["']/g, 'from "../../middleware/validateZod.js"');
  text = text.replace(/\bvalidate\b/g, (match, offset) => {
    // only replace middleware import/use, not unrelated identifiers carefully:
    return match;
  });
  // Replace validate( → validateZod( and import { validate → import { validateZod
  text = text.replace(/import\s*\{\s*validate\s*\}/g, "import { validateZod }");
  text = text.replace(/import\s*\{\s*([^}]*?)\bvalidate\b([^}]*?)\s*\}/g, (full, a, b) => {
    if (full.includes("validateZod")) return full;
    return `import { ${a}validateZod${b} }`.replace(/\s+/g, " ");
  });
  text = text.replace(/\bvalidate\(/g, "validateZod(");
  // Validator → Schema naming when imports use *Validator exports renamed in schemas
  text = text.replace(/(\w+)Validator/g, "$1Schema");

  if (text !== before) {
    fs.writeFileSync(routesPath, text);
    rewritten += 1;
    console.log("rewrote", routesPath);
  }
}
console.log("done, rewritten", rewritten);
