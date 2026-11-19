import { z } from "zod";

/** Auto-generated from communicationLogs.validation.js (Joi → Zod). Review nested refinements as needed. */

export const channels = ["call","note","message","push","email","whatsapp","proof_upload"];

export const createForEntitySchema = z.object({
  "params": z.object({
    "entityType": z.enum(["buy_enquiry", "sell_request", "acquisition", "sales_deal", "visit", "callback", "interior_lead", "support_ticket", "user", "property"]),
    "entityId": z.string().regex(/^[a-fA-F0-9]{24}$/)
  }).strict().optional(),
  "body": z.object({
    "channel": z.enum(["call", "note", "message", "push", "email", "whatsapp", "proof_upload"]),
    "direction": z.enum(["inbound", "outbound", "internal"]).default("internal"),
    "summary": z.string().min(1).max(300),
    "body": z.union([z.string().max(5000).nullable(), z.literal("")]).optional(),
    "outcome": z.union([z.string().max(120).nullable(), z.literal("")]).optional(),
    "durationMinutes": z.coerce.number().min(0).max(1440).optional(),
    "followUpAt": z.coerce.date().nullable().optional(),
    "occurredAt": z.coerce.date().optional(),
    "attachments": z.array(z.object({
      "fileName": z.union([z.string().max(255).nullable(), z.literal("")]).optional(),
      "url": z.string().url(),
      "mimeType": z.union([z.string().max(120).nullable(), z.literal("")]).optional(),
      "sizeBytes": z.coerce.number().int().min(0).optional(),
      "storageKey": z.union([z.string().max(500).nullable(), z.literal("")]).optional()
    }).passthrough()).max(10).default([])
  }).strict().optional()
}).passthrough().passthrough();

export const createSchema = z.object({
  "body": z.object({
    "entityType": z.enum(["buy_enquiry", "sell_request", "acquisition", "sales_deal", "visit", "callback", "interior_lead", "support_ticket", "user", "property"]),
    "entityId": z.string().regex(/^[a-fA-F0-9]{24}$/),
    "channel": z.enum(["call", "note", "message", "push", "email", "whatsapp", "proof_upload"]),
    "direction": z.enum(["inbound", "outbound", "internal"]).default("internal"),
    "summary": z.string().min(1).max(300),
    "body": z.union([z.string().max(5000).nullable(), z.literal("")]).optional(),
    "outcome": z.union([z.string().max(120).nullable(), z.literal("")]).optional(),
    "durationMinutes": z.coerce.number().min(0).max(1440).optional(),
    "followUpAt": z.coerce.date().nullable().optional(),
    "occurredAt": z.coerce.date().optional(),
    "attachments": z.array(z.object({
      "fileName": z.union([z.string().max(255).nullable(), z.literal("")]).optional(),
      "url": z.string().url(),
      "mimeType": z.union([z.string().max(120).nullable(), z.literal("")]).optional(),
      "sizeBytes": z.coerce.number().int().min(0).optional(),
      "storageKey": z.union([z.string().max(500).nullable(), z.literal("")]).optional()
    }).passthrough()).max(10).default([])
  }).strict().optional()
}).passthrough().passthrough();

export const emailSchema = z.object({
  "params": z.object({
    "entityType": z.enum(["buy_enquiry", "sell_request", "acquisition", "sales_deal", "visit", "callback", "interior_lead", "support_ticket", "user", "property"]),
    "entityId": z.string().regex(/^[a-fA-F0-9]{24}$/)
  }).strict().optional(),
  "body": z.object({
    "to": z.string().email(),
    "subject": z.string().min(1).max(200),
    "body": z.string().min(1).max(5000),
    "summary": z.union([z.string().max(300).nullable(), z.literal("")]).optional(),
    "from": z.union([z.string().email().nullable(), z.literal("")]).optional()
  }).strict().optional()
}).passthrough().passthrough();

export const entityTypes = ["buy_enquiry","sell_request","acquisition","sales_deal","visit","callback","interior_lead","support_ticket","user","property"];

export const listSchema = z.object({
  "query": z.object({
    "page": z.coerce.number().int().min(1).optional(),
    "limit": z.coerce.number().int().min(1).max(100).optional(),
    "entityType": z.enum(["buy_enquiry", "sell_request", "acquisition", "sales_deal", "visit", "callback", "interior_lead", "support_ticket", "user", "property"]).optional(),
    "entityId": z.string().regex(/^[a-fA-F0-9]{24}$/).optional(),
    "channel": z.union([z.enum(["call", "note", "message", "push", "email", "whatsapp", "proof_upload"]), z.array(z.enum(["call", "note", "message", "push", "email", "whatsapp", "proof_upload"])).max(7)]).optional(),
    "direction": z.enum(["inbound", "outbound", "internal"]).optional(),
    "search": z.string().max(120).optional()
  }).strict().optional()
}).passthrough().passthrough();

export const pushSchema = z.object({
  "params": z.object({
    "entityType": z.enum(["buy_enquiry", "sell_request", "acquisition", "sales_deal", "visit", "callback", "interior_lead", "support_ticket", "user", "property"]),
    "entityId": z.string().regex(/^[a-fA-F0-9]{24}$/)
  }).strict().optional(),
  "body": z.object({
    "userId": z.union([z.string().regex(/^[a-fA-F0-9]{24}$/).nullable(), z.literal("")]).optional(),
    "recipient": z.union([z.string().max(160).nullable(), z.literal("")]).optional(),
    "notificationId": z.string().max(80),
    "audience": z.enum(["buyer", "seller"]).default("buyer"),
    "image": z.union([z.string().url().nullable(), z.literal("")]).optional(),
    "template": z.object({
      "title": z.string().min(1).max(160),
      "body": z.string().min(1).max(2000),
      "deepLink": z.union([z.string().max(300).nullable(), z.literal("")]).optional()
    }).passthrough(),
    "dedupeKey": z.union([z.string().max(300).nullable(), z.literal("")]).optional(),
    "skipDuplicateCheck": z.coerce.boolean().optional()
  }).strict().optional()
}).passthrough().passthrough();

export const timelineSchema = z.object({
  "params": z.object({
    "entityType": z.enum(["buy_enquiry", "sell_request", "acquisition", "sales_deal", "visit", "callback", "interior_lead", "support_ticket", "user", "property"]),
    "entityId": z.string().regex(/^[a-fA-F0-9]{24}$/)
  }).strict().optional(),
  "query": z.object({
    "page": z.coerce.number().int().min(1).optional(),
    "limit": z.coerce.number().int().min(1).max(100).optional(),
    "channel": z.enum(["call", "note", "message", "push", "email", "whatsapp", "proof_upload"]).optional()
  }).strict().optional()
}).passthrough().passthrough();
