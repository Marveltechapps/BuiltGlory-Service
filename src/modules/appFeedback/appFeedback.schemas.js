import { z } from "zod";

/** Auto-generated from appFeedback.validation.js (Joi → Zod). Review nested refinements as needed. */

export const createSchema = z.object({
  "body": z.object({
    "message": z.string().max(5000),
    "source": z.string().max(80).optional(),
    "sourceScreen": z.string().max(80).optional(),
    "metadata": z.object({

    }).passthrough().optional()
  }).strict().optional()
}).passthrough().passthrough();

export const listSchema = z.object({
  "query": z.object({
    "page": z.coerce.number().int().min(1).optional(),
    "limit": z.coerce.number().int().min(1).max(100).optional(),
    "search": z.string().max(100).optional(),
    "sort": z.enum(["newest", "oldest"]).optional(),
    "status": z.enum(["new", "reviewed", "archived"]).optional(),
    "userId": z.string().regex(/^[a-fA-F0-9]{24}$/).optional()
  }).strict().optional()
}).passthrough().passthrough();

export const updateSchema = z.object({
  "body": z.object({
    "status": z.enum(["new", "reviewed", "archived"])
  }).strict().optional(),
  "params": z.object({

  }).passthrough().optional()
}).passthrough().passthrough();
