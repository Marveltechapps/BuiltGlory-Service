import { z } from "zod";

/** Auto-generated from buyEnquiries.validation.js (Joi → Zod). Review nested refinements as needed. */

export const createSchema = z.object({
  "body": z.object({
    "propertyId": z.string().regex(/^[a-fA-F0-9]{24}$/),
    "enquiryTypes": z.array(z.string().max(80)).default([]),
    "preferredContact": z.enum(["phone", "whatsapp", "email"]),
    "interestType": z.enum(["schedule_visit", "price_negotiation", "more_details"]),
    "preferredVisitTime": z.union([z.enum(["tomorrow_morning", "tomorrow_afternoon", "this_weekend_morning", "this_weekend_afternoon", "custom"]), z.null()]).nullable().optional(),
    "preferredVisitDate": z.coerce.date().nullable().optional(),
    "preferredVisitTimeSlot": z.union([z.string().max(80).nullable(), z.literal("")]).optional(),
    "additionalMessage": z.union([z.string().max(1000).nullable(), z.literal("")]).optional()
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
    "status": z.enum(["new", "responded", "visit_scheduled", "negotiating", "closed"]).optional(),
    "assignedTo": z.string().regex(/^[a-fA-F0-9]{24}$/).optional(),
    "propertyId": z.string().regex(/^[a-fA-F0-9]{24}$/).optional(),
    "buyerId": z.string().regex(/^[a-fA-F0-9]{24}$/).optional()
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
    "status": z.enum(["new", "responded", "visit_scheduled", "negotiating", "closed"]).optional(),
    "assignedTo": z.string().regex(/^[a-fA-F0-9]{24}$/).optional(),
    "preferredContact": z.enum(["phone", "whatsapp", "email"]).optional(),
    "notes": z.union([z.string().max(2000).nullable(), z.literal("")]).optional()
  }).strict().refine((o) => Object.keys(o || {}).length >= 1, { message: "Object must have at least 1 key(s)" }).optional(),
  "params": z.object({

  }).passthrough().optional()
}).passthrough().passthrough();
