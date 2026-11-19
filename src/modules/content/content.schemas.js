import { z } from "zod";

/** Auto-generated from content.validation.js (Joi → Zod). Review nested refinements as needed. */

export const createSchema = z.object({
  "body": z.object({
    "slug": z.string().regex(new RegExp("^[a-z0-9]+(?:-[a-z0-9]+)*$", "")).max(120).optional(),
    "section": z.enum(["home", "onboarding", "faq", "legal", "about", "news", "general", "banner"]),
    "title": z.string().max(180),
    "excerpt": z.union([z.string().max(500).nullable(), z.literal("")]).optional(),
    "body": z.union([z.string().max(30000).nullable(), z.literal("")]).optional(),
    "category": z.union([z.string().max(80).nullable(), z.literal("")]).optional(),
    "status": z.enum(["draft", "published", "archived"]).optional(),
    "imageUrl": z.union([z.string().url().nullable(), z.literal("")]).optional(),
    "cta": z.object({
      "label": z.union([z.string().max(80).nullable(), z.literal("")]).optional(),
      "target": z.union([z.string().max(300).nullable(), z.literal("")]).optional()
    }).passthrough().nullable().optional(),
    "tags": z.array(z.string().max(50)).max(20).optional(),
    "order": z.coerce.number().int().min(0).max(10000).optional(),
    "metadata": z.object({

    }).passthrough().optional(),
    "publishedAt": z.coerce.date().nullable().optional()
  }).strict().optional()
}).passthrough().passthrough();

export const listSchema = z.object({
  "query": z.object({
    "page": z.coerce.number().int().min(1).optional(),
    "limit": z.coerce.number().int().min(1).max(100).optional(),
    "section": z.enum(["home", "onboarding", "faq", "legal", "about", "news", "general", "banner"]).optional(),
    "category": z.string().max(80).optional(),
    "status": z.enum(["draft", "published", "archived"]).optional(),
    "search": z.string().max(100).optional(),
    "sort": z.enum(["newest", "oldest"]).optional()
  }).passthrough().optional()
}).passthrough().passthrough();

export const publicListSchema = z.object({
  "query": z.object({
    "section": z.enum(["home", "onboarding", "faq", "legal", "about", "news", "general", "banner"]).optional(),
    "category": z.string().max(80).optional(),
    "search": z.string().max(100).optional(),
    "limit": z.coerce.number().int().min(1).max(100).optional()
  }).passthrough().optional()
}).passthrough().passthrough();

export const reorderSchema = z.object({
  "body": z.object({
    "items": z.array(z.object({
      "id": z.string().regex(/^[a-fA-F0-9]{24}$/),
      "order": z.coerce.number().int().min(0).max(10000)
    }).passthrough()).min(1)
  }).strict().optional()
}).passthrough().passthrough();

export const updateSchema = z.object({
  "params": z.object({
    "contentId": z.string().regex(/^[a-fA-F0-9]{24}$/)
  }).passthrough().optional(),
  "body": z.object({
    "slug": z.string().regex(new RegExp("^[a-z0-9]+(?:-[a-z0-9]+)*$", "")).max(120).optional(),
    "section": z.enum(["home", "onboarding", "faq", "legal", "about", "news", "general", "banner"]).optional(),
    "title": z.string().max(180).optional(),
    "excerpt": z.union([z.string().max(500).nullable(), z.literal("")]).optional(),
    "body": z.union([z.string().max(30000).nullable(), z.literal("")]).optional(),
    "category": z.union([z.string().max(80).nullable(), z.literal("")]).optional(),
    "status": z.enum(["draft", "published", "archived"]).optional(),
    "imageUrl": z.union([z.string().url().nullable(), z.literal("")]).optional(),
    "cta": z.object({
      "label": z.union([z.string().max(80).nullable(), z.literal("")]).optional(),
      "target": z.union([z.string().max(300).nullable(), z.literal("")]).optional()
    }).passthrough().nullable().optional(),
    "tags": z.array(z.string().max(50)).max(20).optional(),
    "order": z.coerce.number().int().min(0).max(10000).optional(),
    "metadata": z.object({

    }).passthrough().optional(),
    "publishedAt": z.coerce.date().nullable().optional()
  }).strict().refine((o) => Object.keys(o || {}).length >= 1, { message: "Object must have at least 1 key(s)" }).optional()
}).passthrough().passthrough();
