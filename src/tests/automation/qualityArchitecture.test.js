import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPagination } from "../../utils/pagination.js";
import { assertTransition, requireSuperAdmin, transitions, validatePropertyPublication } from "../../services/workflow.rules.js";

const srcRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const modulesRoot = path.join(srcRoot, "modules");

const read = (relativePath) => fs.readFileSync(path.join(srcRoot, relativePath), "utf8");

const walk = (directory) => {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "tests") continue;
      files.push(...walk(fullPath));
    } else if (entry.name.endsWith(".js")) {
      files.push(fullPath);
    }
  }
  return files;
};

const sourceFiles = walk(srcRoot);

describe("code quality", () => {
  test("application source does not embed secrets or dynamic code execution", () => {
    const forbidden = [
      { name: "eval", pattern: /\beval\s*\(/ },
      { name: "Function constructor", pattern: /\bnew\s+Function\s*\(/ },
      { name: "AWS access key", pattern: /\bAKIA[0-9A-Z]{16}\b/ },
      { name: "private key block", pattern: /-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/ }
    ];
    const findings = [];
    for (const file of sourceFiles) {
      const text = fs.readFileSync(file, "utf8");
      for (const rule of forbidden) {
        if (rule.pattern.test(text)) findings.push(`${path.relative(srcRoot, file)}: ${rule.name}`);
      }
    }
    expect(findings).toEqual([]);
  });

  test("feature services stay free of HTTP response objects", () => {
    const offenders = sourceFiles
      .filter((file) => /\.service\.js$/.test(file) && file.includes(`${path.sep}modules${path.sep}`))
      .filter((file) => /from\s+["']express["']|res\.(status|json|send)\s*\(/.test(fs.readFileSync(file, "utf8")))
      .map((file) => path.relative(srcRoot, file));
    expect(offenders).toEqual([]);
  });

  test("admin and profile routes declare authentication", () => {
    const routeFiles = fs.readdirSync(modulesRoot)
      .map((name) => path.join(modulesRoot, name, `${name}.routes.js`))
      .filter((file) => fs.existsSync(file));
    const missing = [];
    for (const file of routeFiles) {
      const text = fs.readFileSync(file, "utf8");
      if (text.includes('"/admin') && !text.includes('authenticate("admin")')) missing.push(`${path.basename(path.dirname(file))}: admin`);
      if (text.includes('"/me') && !text.includes('authenticate("customer")') && !text.includes('authenticate("admin")')) {
        missing.push(`${path.basename(path.dirname(file))}: profile`);
      }
    }
    expect(missing).toEqual([]);
  });
});

describe("architecture", () => {
  test("HTTP pipeline keeps security middleware ahead of routers", () => {
    const app = read("app.js");
    const order = [
      "app.use(requestContext)",
      "app.use(requestLogger)",
      "app.use(helmet())",
      "app.use(compression())",
      "app.use(cors(",
      "app.use(cookieParser())",
      "app.use(mongoSanitize)",
      "app.use(generalLimiter)",
      'app.use("/api/v1", routes)',
      "app.use(notFoundHandler)",
      "app.use(errorHandler)"
    ];
    let cursor = -1;
    for (const marker of order) {
      const index = app.indexOf(marker);
      expect(index).toBeGreaterThan(cursor);
      cursor = index;
    }
    expect(app.indexOf('express.raw({ type: "application/json"')).toBeLessThan(app.indexOf("express.json("));
  });

  test("every feature router is mounted once", () => {
    const mounts = `${read("routes/index.js")}\n${read("app.js")}`;
    const unmounted = fs.readdirSync(modulesRoot)
      .filter((name) => fs.existsSync(path.join(modulesRoot, name, `${name}.routes.js`)))
      .filter((name) => !mounts.includes(`modules/${name}/${name}.routes.js`));
    expect(unmounted).toEqual([]);
  });

  test("module files follow the <module>.<role>.js naming convention", () => {
    const offenders = fs.readdirSync(modulesRoot)
      .filter((name) => name !== "error")
      .flatMap((name) => fs.readdirSync(path.join(modulesRoot, name))
        .filter((file) => file.endsWith(".js") && !file.startsWith(`${name}.`))
        .map((file) => `${name}/${file}`));
    expect(offenders).toEqual([]);
  });

  test("every feature module owns an error file", () => {
    const missing = fs.readdirSync(modulesRoot)
      .filter((name) => name !== "error")
      .filter((name) => !fs.existsSync(path.join(modulesRoot, name, `${name}.error.js`)));
    expect(missing).toEqual([]);
  });

  test("route files only wire middleware to controller handlers", () => {
    const offenders = fs.readdirSync(modulesRoot)
      .map((name) => path.join(modulesRoot, name, `${name}.routes.js`))
      .filter((file) => fs.existsSync(file))
      .filter((file) => /async\s*\(req|asyncHandler\(|controller\.action\(/.test(fs.readFileSync(file, "utf8")))
      .map((file) => path.relative(srcRoot, file));
    expect(offenders).toEqual([]);
  });

  test("persistence models register the soft-delete plugin", () => {
    const exceptions = new Set(["adminSettings", "editLocks", "auth", "reports", "error"]);
    const missing = fs.readdirSync(modulesRoot)
      .filter((name) => fs.existsSync(path.join(modulesRoot, name, `${name}.model.js`)))
      .filter((name) => !exceptions.has(name))
      .filter((name) => !fs.readFileSync(path.join(modulesRoot, name, `${name}.model.js`), "utf8").includes("softDeletePlugin"));
    expect(missing).toEqual([]);
  });

  test("workflow maps and permission-bearing modules stay in the shared layer", () => {
    expect(Object.keys(transitions).sort()).toEqual([
      "acquisitionStage",
      "buyEnquiryStatus",
      "callbackStatus",
      "interiorLeadStatus",
      "paymentStatus",
      "propertyStatus",
      "salesDealStage",
      "sellRequestStatus",
      "supportTicketStatus",
      "visitStatus"
    ]);
    expect(read("routes/index.js")).toContain('router.use(propertiesRoutes)');
    expect(read("utils/response.js")).toContain("requestId");
  });
});

describe("business logic", () => {
  test("pagination clamps page and limit", () => {
    expect(getPagination({ page: 0, limit: 500 })).toEqual({ page: 1, limit: 100, skip: 0 });
    expect(getPagination({ page: "3", limit: "15" })).toEqual({ page: 3, limit: 15, skip: 30 });
  });

  test("publication requires a complete public listing", () => {
    expect(() => validatePropertyPublication({
      title: "Lake plot",
      description: "East facing",
      type: "plot",
      price: 2500000,
      address: { city: "Bengaluru", locality: "Whitefield", pincode: "560066" },
      media: { coverPhoto: "s3://bucket/cover.jpg" }
    })).not.toThrow();
    expect(() => validatePropertyPublication({ title: "Incomplete", address: { pincode: "12" }, media: {} })).toThrow("Property cannot be published");
  });

  test("terminal states cannot move backwards", () => {
    expect(() => assertTransition("paymentStatus", "paid", "refunded")).not.toThrow();
    expect(() => assertTransition("paymentStatus", "refunded", "paid")).toThrow("Invalid state transition");
    expect(() => assertTransition("visitStatus", "completed", "scheduled")).toThrow("Invalid state transition");
    expect(() => assertTransition("propertyStatus", "sold", "available")).toThrow("Invalid state transition");
  });

  test("super-admin approval is role gated", () => {
    expect(() => requireSuperAdmin({ role: "super_admin" })).not.toThrow();
    expect(() => requireSuperAdmin({ role: "sales_executive" })).toThrow("Super admin approval required.");
  });
});
