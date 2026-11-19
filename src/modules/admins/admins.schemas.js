import { z } from "zod";

/** Auto-generated from admins.validation.js (Joi → Zod). Review nested refinements as needed. */

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
    "name": z.string().max(120).optional(),
    "email": z.string().email().optional(),
    "role": z.string().max(40).optional(),
    "phone": z.union([z.string().max(30).nullable(), z.literal("")]).optional(),
    "photoUrl": z.union([z.string().url().nullable(), z.literal("")]).optional(),
    "department": z.union([z.string().max(80).nullable(), z.literal("")]).optional(),
    "assignedArea": z.array(z.string().max(80)).max(30).optional(),
    "specialization": z.array(z.string().max(80)).max(30).optional(),
    "isAvailable": z.coerce.boolean().optional(),
    "isActive": z.coerce.boolean().optional(),
    "status": z.enum(["active", "suspended", "invited"]).optional(),
    "permissions": z.array(z.string().max(80)).max(100).optional()
  }).strict().refine((o) => Object.keys(o || {}).length >= 1, { message: "Object must have at least 1 key(s)" }).optional(),
  "params": z.object({

  }).passthrough().optional()
}).passthrough().passthrough();
