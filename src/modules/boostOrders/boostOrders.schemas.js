import { z } from "zod";

const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/);
const statusEnum = z.enum(["scheduled", "active", "expired", "cancelled"]);

export const listSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    propertyId: objectId.optional(),
    status: statusEnum.optional(),
    sort: z.enum(["newest", "oldest"]).optional()
  }).strict().optional()
}).passthrough();

export const idParam = z.object({
  params: z.object({
    boostOrderId: objectId
  }).passthrough()
}).passthrough();

export const createSchema = z.object({
  body: z.object({
    propertyId: objectId,
    planId: z.string().trim().min(1).max(100),
    sellRequestId: objectId.optional(),
    amount: z.number().int().min(0).optional(),
    startsAt: z.coerce.date(),
    expiresAt: z.coerce.date(),
    status: statusEnum.optional()
  }).strict().refine((b) => b.expiresAt > b.startsAt, { message: "expiresAt must be after startsAt", path: ["expiresAt"] })
}).passthrough();

export const updateSchema = z.object({
  params: z.object({ boostOrderId: objectId }).passthrough(),
  body: z.object({
    status: statusEnum.optional(),
    startsAt: z.coerce.date().optional(),
    expiresAt: z.coerce.date().optional(),
    amount: z.number().int().min(0).optional()
  }).strict().refine((b) => Object.keys(b).length > 0, { message: "At least one field is required" })
}).passthrough();
