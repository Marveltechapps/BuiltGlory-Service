import { z } from "zod";

/** Auto-generated from supportTickets.validation.js (Joi → Zod). Review nested refinements as needed. */

export const createSchema = z.object({
  "body": z.object({
    "category": z.enum(["property_inquiry", "payment", "technical", "kyc", "general", "complaint"]),
    "subject": z.string().max(200),
    "message": z.string().max(5000),
    "priority": z.enum(["low", "medium", "high", "urgent"]).optional(),
    "channel": z.enum(["ticket", "live_chat"]).optional(),
    "attachments": z.array(z.string()).optional()
  }).strict().optional()
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
    "sort": z.enum(["newest", "oldest"]).optional(),
    "status": z.enum(["open", "in_progress", "resolved", "closed"]).optional(),
    "priority": z.enum(["low", "medium", "high", "urgent"]).optional(),
    "channel": z.enum(["ticket", "live_chat"]).optional(),
    "assignedTo": z.string().regex(/^[a-fA-F0-9]{24}$/).optional(),
    "userId": z.string().regex(/^[a-fA-F0-9]{24}$/).optional()
  }).strict().optional()
}).passthrough().passthrough();

export const liveChatStartSchema = z.object({
  "body": z.object({
    "category": z.enum(["property_inquiry", "payment", "technical", "kyc", "general", "complaint"]).optional(),
    "subject": z.string().max(200).optional(),
    "message": z.string().max(5000).optional(),
    "priority": z.enum(["low", "medium", "high", "urgent"]).optional(),
    "attachments": z.array(z.string()).optional()
  }).strict().optional()
}).passthrough().passthrough();

export const responseSchema = z.object({
  "body": z.object({
    "message": z.string().max(5000),
    "clientMessageId": z.string().max(120).optional(),
    "resolve": z.coerce.boolean().optional()
  }).strict().optional(),
  "params": z.object({

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
    "message": z.string().max(5000).optional(),
    "clientMessageId": z.string().max(120).optional(),
    "resolve": z.coerce.boolean().optional(),
    "resolutionResponse": z.string().max(5000).optional(),
    "status": z.enum(["open", "in_progress", "resolved", "closed"]).optional(),
    "priority": z.enum(["low", "medium", "high", "urgent"]).optional(),
    "assignedTo": z.union([z.string().regex(/^[a-fA-F0-9]{24}$/).nullable(), z.literal("")]).optional(),
    "escalation": z.object({
      "targetAssignee": z.string().regex(/^[a-fA-F0-9]{24}$/),
      "reason": z.string().max(1000)
    }).passthrough().optional()
  }).strict().refine((o) => Object.keys(o || {}).length >= 1, { message: "Object must have at least 1 key(s)" }).optional(),
  "params": z.object({

  }).passthrough().optional()
}).passthrough().passthrough();
