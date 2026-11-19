import { z } from "zod";

/** Auto-generated from callbacks.validation.js (Joi → Zod). Review nested refinements as needed. */

export const createSchema = z.object({
  "body": z.object({
    "source": z.enum(["help_support", "profile_support", "property_detail", "payment", "interior"]),
    "sourceScreen": z.union([z.string().max(120).nullable(), z.literal("")]).optional(),
    "category": z.enum(["property_inquiry", "pricing", "technical_issue", "complaint", "general", "stage_payment", "interior"]).optional(),
    "propertyId": z.string().regex(/^[a-fA-F0-9]{24}$/).optional(),
    "reason": z.union([z.string().max(1000).nullable(), z.literal("")]).optional(),
    "preferredTime": z.coerce.date().optional(),
    "bestTimePreference": z.enum(["morning", "afternoon", "evening"]).optional()
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
    "status": z.enum(["pending", "called", "resolved", "missed", "rescheduled", "overdue"]).optional(),
    "assignedTo": z.string().regex(/^[a-fA-F0-9]{24}$/).optional(),
    "userId": z.string().regex(/^[a-fA-F0-9]{24}$/).optional()
  }).strict().optional()
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
    "outcome": z.enum(["answered", "no_answer", "busy", "wrong_number", "callback_later"]).optional(),
    "notes": z.union([z.string().max(2000).nullable(), z.literal("")]).optional(),
    "resolutionNotes": z.union([z.string().max(2000).nullable(), z.literal("")]).optional(),
    "preferredTime": z.coerce.date().optional(),
    "reason": z.union([z.string().max(500).nullable(), z.literal("")]).optional(),
    "assignedTo": z.string().regex(/^[a-fA-F0-9]{24}$/).optional()
  }).strict().refine((o) => Object.keys(o || {}).length >= 1, { message: "Object must have at least 1 key(s)" }).optional(),
  "params": z.object({

  }).passthrough().optional()
}).passthrough().passthrough();
