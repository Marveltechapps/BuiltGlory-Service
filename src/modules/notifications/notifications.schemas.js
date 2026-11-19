import { z } from "zod";

/** Auto-generated from notifications.validation.js (Joi → Zod). Review nested refinements as needed. */

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
    "sort": z.string().max(40).optional(),
    "status": z.enum(["unread", "read"]).optional(),
    "isRead": z.coerce.boolean().optional()
  }).passthrough().optional()
}).passthrough().passthrough();

export const markReadSchema = z.object({
  "body": z.object({
    "ids": z.array(z.string().regex(/^[a-fA-F0-9]{24}$/)).max(100).optional()
  }).strict().optional(),
  "params": z.object({
    "id": z.string().regex(/^[a-fA-F0-9]{24}$/).optional()
  }).passthrough().optional()
}).passthrough().passthrough();

export const sendPushSchema = z.object({
  "body": z.object({
    "userId": z.string().regex(/^[a-fA-F0-9]{24}$/),
    "audience": z.enum(["buyer", "seller"]).default("buyer"),
    "notificationType": z.string().max(80).optional(),
    "title": z.string().max(200),
    "message": z.string().max(2000),
    "screen": z.string().max(40).optional(),
    "screenKey": z.string().max(80).optional(),
    "listingId": z.union([z.string().nullable(), z.literal("")]).optional(),
    "enquiryId": z.union([z.string().nullable(), z.literal("")]).optional(),
    "dealId": z.union([z.string().nullable(), z.literal("")]).optional(),
    "propertyId": z.union([z.string().nullable(), z.literal("")]).optional(),
    "entityId": z.union([z.string().nullable(), z.literal("")]).optional(),
    "entityType": z.string().max(80).optional(),
    "deepLink": z.string().max(80).optional(),
    "image": z.union([z.string().nullable(), z.literal("")]).optional(),
    "dedupeKey": z.string().max(200).optional()
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
    "isRead": z.coerce.boolean().optional(),
    "readAt": z.coerce.date().nullable().optional()
  }).strict().refine((o) => Object.keys(o || {}).length >= 1, { message: "Object must have at least 1 key(s)" }).optional(),
  "params": z.object({

  }).passthrough().optional()
}).passthrough().passthrough();
