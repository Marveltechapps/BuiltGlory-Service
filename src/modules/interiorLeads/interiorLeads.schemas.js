import { z } from "zod";

/** Auto-generated from interiorLeads.validation.js (Joi → Zod). Review nested refinements as needed. */

export const createSchema = z.object({
  "body": z.object({

  }).passthrough().refine((o) => Object.keys(o || {}).length >= 1, { message: "Object must have at least 1 key(s)" }).optional()
}).passthrough().passthrough();

export const idParam = z.object({
  "params": z.object({
    "id": z.string().regex(/^[a-fA-F0-9]{24}$/).optional()
  }).passthrough().optional()
}).passthrough().passthrough();

export const listSchema = z.object({
  "query": z.object({
    "page": z.coerce.number().int().min(1).optional(),
    "limit": z.coerce.number().int().min(1).max(100).optional(),
    "search": z.string().max(100).optional(),
    "sort": z.string().max(40).optional()
  }).passthrough().optional()
}).passthrough().passthrough();

export const statusSchema = z.object({
  "body": z.object({
    "status": z.string().optional(),
    "stage": z.string().optional(),
    "decision": z.string().optional(),
    "notes": z.union([z.string().nullable(), z.literal("")]).optional(),
    "reason": z.union([z.string().nullable(), z.literal("")]).optional()
  }).passthrough().optional(),
  "params": z.object({

  }).passthrough().optional()
}).passthrough().passthrough();

export const updateSchema = z.object({
  "body": z.object({
    "status": z.enum(["new", "contacted", "quote_sent", "negotiating", "accepted", "completed", "declined"]).optional(),
    "assignedDesigner": z.string().regex(/^[a-fA-F0-9]{24}$/).nullable().optional(),
    "notes": z.union([z.string().max(4000).nullable(), z.literal("")]).optional(),
    "remoteCoordinationNotes": z.union([z.string().max(4000).nullable(), z.literal("")]).optional(),
    "selectedRooms": z.array(z.string().max(80)).max(30).optional(),
    "designStyle": z.enum(["modern", "classic", "contemporary", "minimalist"]).optional(),
    "budgetRange": z.enum(["budget", "standard", "premium", "luxury"]).optional(),
    "userType": z.string().max(40).optional(),
    "quote": z.object({
      "amount": z.coerce.number().positive().optional(),
      "packageName": z.string().max(200).optional(),
      "timeline": z.string().max(200).optional(),
      "inclusions": z.array(z.string().max(200)).optional(),
      "validUntil": z.coerce.date().optional()
    }).passthrough().optional(),
    "customerAcceptedAt": z.coerce.date().optional(),
    "completionNote": z.union([z.string().max(4000).nullable(), z.literal("")]).optional()
  }).strict().refine((o) => Object.keys(o || {}).length >= 1, { message: "Object must have at least 1 key(s)" }).optional(),
  "params": z.object({

  }).passthrough().optional()
}).passthrough().passthrough();
