import { Router } from "express";
import { authenticate, requireAnyPermission, requirePermission } from "../../middleware/auth.js";
import { validateZod } from "../../middleware/validateZod.js";
import { controller } from "./reports.controller.js";
import { analyticsSchema, summarySchema, exportSchema, exportListSchema, exportIdSchema, exportDownloadSchema, scheduleSchema, scheduleListSchema } from "./reports.schemas.js";

const router = Router();

// Public login-screen KPIs (non-sensitive counts). Docs: dashboard 01-API-CONTRACT A4 / 04-AUTH §1.
router.get("/public/admin-login-stats", controller.loginStats);
router.get(
  "/admin/overview",
  authenticate("admin"),
  requireAnyPermission(["sales.read", "acquisitions.read", "support.read", "users.read", "visits.read", "audit.read"]),
  controller.overview
);
router.get("/admin/reports/summary", authenticate("admin"), requirePermission("sales.read"), validateZod(summarySchema), controller.summary);
router.get("/admin/reports/sales/analytics", authenticate("admin"), requirePermission("sales.read"), validateZod(analyticsSchema), controller.salesAnalytics);
router.get("/admin/reports/acquisition/analytics", authenticate("admin"), requirePermission("acquisitions.read"), validateZod(analyticsSchema), controller.acquisitionAnalytics);
router.get("/admin/reports/revenue/analytics", authenticate("admin"), requirePermission("sales.read"), validateZod(analyticsSchema), controller.revenueAnalytics);
router.get("/admin/reports/schedules", authenticate("admin"), requirePermission("audit.read"), validateZod(scheduleListSchema), controller.listSchedules);
router.post("/admin/reports/schedules", authenticate("admin"), requirePermission("audit.read"), validateZod(scheduleSchema), controller.createSchedule);
router.get("/admin/reports/exports", authenticate("admin"), requirePermission("audit.read"), validateZod(exportListSchema), controller.listExports);
router.get("/admin/reports/exports/:id", authenticate("admin"), requirePermission("audit.read"), validateZod(exportIdSchema), controller.getExport);
router.get("/admin/reports/exports/:id/download-url", authenticate("admin"), requirePermission("audit.read"), validateZod(exportIdSchema), controller.getExportDownloadUrl);
router.get("/admin/reports/exports/:id/download", validateZod(exportDownloadSchema), controller.downloadExport);
router.post("/admin/reports/export", authenticate("admin"), requirePermission("audit.read"), validateZod(exportSchema), controller.exportRequest);

export default router;
