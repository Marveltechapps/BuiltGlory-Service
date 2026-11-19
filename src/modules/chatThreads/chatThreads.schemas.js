import { z } from "zod";

/** Auto-generated from chatThreads.validation.js (Joi → Zod). Review nested refinements as needed. */

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
  "body": z.union([z.object({
    "decision": z.enum(["accepted", "declined", "countered"]),
    "counterAmount": z.coerce.number().positive().optional(),
    "notes": z.union([z.string().max(2000).nullable(), z.literal("")]).optional()
  }).strict(), z.object({
    "type": z.enum(["text", "offer", "deal_agreed"]).optional(),
    "text": z.union([z.string().max(4000).nullable(), z.literal("")]).optional(),
    "offerAmount": z.coerce.number().positive().optional(),
    "notes": z.union([z.string().max(2000).nullable(), z.literal("")]).optional()
  }).strict()]),
  "params": z.object({

  }).passthrough().optional()
}).passthrough().passthrough();
