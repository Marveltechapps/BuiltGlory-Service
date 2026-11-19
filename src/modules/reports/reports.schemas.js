import { z } from "zod";

/** Auto-generated from reports.validation.js (Joi → Zod). Review nested refinements as needed. */

export const analyticsSchema = z.object({
  "query": z.object({
    "from": z.coerce.date().optional(),
    "to": z.coerce.date().optional(),
    "propertyType": z.string().max(80).optional()
  }).strict().optional()
}).passthrough().passthrough();

export const exportDownloadSchema = z.object({
  "params": z.object({
    "id": z.string().max(80)
  }).strict().optional(),
  "query": z.object({
    "token": z.string().max(160)
  }).strict().optional()
}).passthrough().passthrough();

export const exportIdSchema = z.object({
  "params": z.object({
    "id": z.string().max(80)
  }).strict().optional()
}).passthrough().passthrough();

export const exportListSchema = z.object({
  "query": z.object({
    "page": z.coerce.number().int().min(1).optional(),
    "limit": z.coerce.number().int().min(1).max(100).optional(),
    "status": z.enum(["queued", "processing", "completed", "failed", "expired"]).optional()
  }).strict().optional()
}).passthrough().passthrough();

export const exportSchema = z.object({
  "body": z.object({
    "filters": z.object({
      "reportType": z.enum(["properties", "users", "sales", "sales_deals", "acquisitions"]).default("properties"),
      "format": z.enum(["csv", "xlsx", "excel", "pdf"]).default("xlsx"),
      "fields": z.array(z.string().max(80)).max(50).optional(),
      "from": z.coerce.date().optional(),
      "to": z.coerce.date().optional(),
      "estimatedRows": z.coerce.number().int().min(0).optional(),
      "deliveryEmail": z.union([z.string().email().nullable(), z.literal("")]).optional(),
      "limit": z.coerce.number().int().min(1).max(50000).optional()
    }).passthrough().default({})
  }).strict().optional()
}).passthrough().passthrough();

export const scheduleListSchema = z.object({
  "query": z.object({
    "page": z.coerce.number().int().min(1).optional(),
    "limit": z.coerce.number().int().min(1).max(100).optional(),
    "status": z.enum(["active", "paused"]).optional(),
    "reportType": z.enum(["overview", "sales", "acquisition", "revenue", "users", "properties"]).optional()
  }).strict().optional()
}).passthrough().passthrough();

export const scheduleSchema = z.object({
  "body": z.object({
    "name": z.string().min(2).max(120),
    "reportType": z.enum(["overview", "sales", "acquisition", "revenue", "users", "properties"]),
    "format": z.enum(["csv", "xlsx", "pdf"]).default("xlsx"),
    "frequency": z.enum(["daily", "weekly", "monthly"]),
    "timezone": z.string().max(80).default("Asia/Kolkata"),
    "filters": z.object({

    }).passthrough().default({}),
    "recipients": z.array(z.string().email()).min(1).max(25),
    "nextRunAt": z.coerce.date().optional()
  }).strict().optional()
}).passthrough().passthrough();

export const summarySchema = z.object({
  "query": z.object({
    "from": z.coerce.date().optional(),
    "to": z.coerce.date().optional()
  }).strict().optional()
}).passthrough().passthrough();
