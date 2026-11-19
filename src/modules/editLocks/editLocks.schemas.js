import { z } from "zod";

/** Auto-generated from editLocks.validation.js (Joi → Zod). Review nested refinements as needed. */

export const entityTypes = ["buy_enquiry","sell_request","acquisition","sales_deal","visit","callback","interior_lead","support_ticket","user","property"];

export const lockParamsSchema = z.object({
  "params": z.object({
    "entityType": z.enum(["buy_enquiry", "sell_request", "acquisition", "sales_deal", "visit", "callback", "interior_lead", "support_ticket", "user", "property"]),
    "entityId": z.string().regex(/^[a-fA-F0-9]{24}$/)
  }).strict().optional()
}).passthrough().passthrough();

export const lockSchema = z.object({
  "params": z.object({
    "entityType": z.enum(["buy_enquiry", "sell_request", "acquisition", "sales_deal", "visit", "callback", "interior_lead", "support_ticket", "user", "property"]),
    "entityId": z.string().regex(/^[a-fA-F0-9]{24}$/)
  }).strict().optional(),
  "body": z.object({
    "ttlSeconds": z.coerce.number().int().min(60).max(3600).optional()
  }).strict().optional()
}).passthrough().passthrough();
