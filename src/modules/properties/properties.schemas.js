import { z } from "zod";
import { booleanish } from "../../utils/zodHelpers.js";

/** Auto-generated from properties.validation.js (Joi → Zod). Review nested refinements as needed. */

export const createSchema = z.object({
  "body": z.object({
    "title": z.string().max(200),
    "description": z.union([z.string().max(5000).nullable(), z.literal("")]).optional(),
    "type": z.enum(["plot", "apartment", "villa", "commercial", "land", "fractional", "3d_printing", "organic_home", "ceo_mansion", "holiday_home", "farmhouse", "nri", "interior", "residential"]),
    "status": z.enum(["available", "sold", "reserved", "under_construction", "draft"]).optional(),
    "source": z.enum(["acquired", "manual", "bulk_upload"]).optional(),
    "isFeatured": booleanish.optional(),
    "isUpcoming": booleanish.optional(),
    "isVisibleOnApp": booleanish.optional(),
    "address": z.object({
      "line1": z.union([z.string().nullable(), z.literal("")]).optional(),
      "line2": z.union([z.string().nullable(), z.literal("")]).optional(),
      "locality": z.union([z.string().nullable(), z.literal("")]).optional(),
      "city": z.union([z.string().nullable(), z.literal("")]).optional(),
      "state": z.union([z.string().nullable(), z.literal("")]).optional(),
      "pincode": z.union([z.string().regex(new RegExp("^\\d{6}$", "")).nullable(), z.literal("")]).optional(),
      "landmark": z.union([z.string().nullable(), z.literal("")]).optional(),
      "latitude": z.coerce.number().optional(),
      "longitude": z.coerce.number().optional()
    }).passthrough().optional(),
    "price": z.coerce.number().positive(),
    "isNegotiable": booleanish.optional(),
    "specs": z.object({

    }).passthrough().optional(),
    "amenities": z.array(z.string()).optional(),
    "media": z.object({

    }).passthrough().optional(),
    "advantages": z.object({

    }).passthrough().optional(),
    "nearbyPlaces": z.array(z.object({

    }).passthrough()).optional(),
    "highlights": z.array(z.string()).optional(),
    "assignedTo": z.string().regex(/^[a-fA-F0-9]{24}$/).optional(),
    "launchDate": z.coerce.date().nullable().optional(),
    "possessionDate": z.coerce.date().nullable().optional()
  }).strict().optional()
}).passthrough().passthrough();

export const idParam = z.object({
  "params": z.object({
    "id": z.string().regex(/^[a-fA-F0-9]{24}$/).optional()
  }).passthrough().optional()
}).passthrough().passthrough();

export const listSchema = z.object({
  "query": z.object({
    "type": z.enum(["plot", "apartment", "villa", "commercial", "land", "fractional", "3d_printing", "organic_home", "ceo_mansion", "holiday_home", "farmhouse", "nri", "interior", "residential"]).optional(),
    "city": z.string().optional(),
    "locality": z.string().optional(),
    "minPrice": z.coerce.number().min(0).optional(),
    "maxPrice": z.coerce.number().min(0).optional(),
    "minArea": z.coerce.number().min(0).optional(),
    "maxArea": z.coerce.number().min(0).optional(),
    "bhk": z.string().optional(),
    "amenities": z.string().optional(),
    "facing": z.string().optional(),
    "furnishing": z.string().optional(),
    "propertyAge": z.string().optional(),
    "possession": z.string().optional(),
    "constructionStatus": z.string().optional(),
    "postedBy": z.enum(["owner", "builder", "dealer", "Owner", "Builder", "Dealer"]).optional(),
    "verified": booleanish.optional(),
    "negotiable": booleanish.optional(),
    "isNegotiable": booleanish.optional(),
    "recentlySold": booleanish.optional(),
    "featured": booleanish.optional(),
    "upcoming": booleanish.optional(),
    "isVisibleOnApp": booleanish.optional(),
    "status": z.union([z.string(), z.array(z.string())]).optional(),
    "source": z.enum(["acquired", "manual", "bulk_upload"]).optional(),
    "assignedTo": z.string().regex(/^[a-fA-F0-9]{24}$/).optional(),
    "includeDeleted": booleanish.optional(),
    "deletedOnly": booleanish.optional(),
    "search": z.string().max(100).optional(),
    "sort": z.enum(["relevance", "price_asc", "price_desc", "newest", "oldest"]).optional(),
    "page": z.coerce.number().int().min(1).optional(),
    "limit": z.coerce.number().int().min(1).max(100).optional()
  }).strict().optional()
}).passthrough().passthrough();

export const statusSchema = z.object({
  "body": z.object({
    "status": z.enum(["available", "sold", "reserved", "under_construction", "draft"]),
    "notes": z.union([z.string().nullable(), z.literal("")]).optional(),
    "reason": z.union([z.string().nullable(), z.literal("")]).optional(),
    "closedDealId": z.string().regex(/^[a-fA-F0-9]{24}$/).optional(),
    "override": booleanish.optional(),
    "effectiveAt": z.coerce.date().optional()
  }).strict().optional(),
  "params": z.object({

  }).passthrough().optional()
}).passthrough().passthrough();

export const updateSchema = z.object({
  "body": z.object({
    "title": z.string().max(200).optional(),
    "description": z.union([z.string().max(5000).nullable(), z.literal("")]).optional(),
    "type": z.enum(["plot", "apartment", "villa", "commercial", "land", "fractional", "3d_printing", "organic_home", "ceo_mansion", "holiday_home", "farmhouse", "nri", "interior", "residential"]).optional(),
    "isFeatured": booleanish.optional(),
    "isUpcoming": booleanish.optional(),
    "isVisibleOnApp": booleanish.optional(),
    "address": z.object({
      "line1": z.union([z.string().nullable(), z.literal("")]).optional(),
      "line2": z.union([z.string().nullable(), z.literal("")]).optional(),
      "locality": z.union([z.string().nullable(), z.literal("")]).optional(),
      "city": z.union([z.string().nullable(), z.literal("")]).optional(),
      "state": z.union([z.string().nullable(), z.literal("")]).optional(),
      "pincode": z.union([z.string().regex(new RegExp("^\\d{6}$", "")).nullable(), z.literal("")]).optional(),
      "landmark": z.union([z.string().nullable(), z.literal("")]).optional(),
      "latitude": z.coerce.number().optional(),
      "longitude": z.coerce.number().optional()
    }).passthrough().optional(),
    "price": z.coerce.number().positive().optional(),
    "isNegotiable": booleanish.optional(),
    "specs": z.object({

    }).passthrough().optional(),
    "amenities": z.array(z.string()).optional(),
    "media": z.object({

    }).passthrough().optional(),
    "advantages": z.object({

    }).passthrough().optional(),
    "nearbyPlaces": z.array(z.object({

    }).passthrough()).optional(),
    "highlights": z.array(z.string()).optional(),
    "assignedTo": z.string().regex(/^[a-fA-F0-9]{24}$/).optional(),
    "launchDate": z.coerce.date().nullable().optional(),
    "possessionDate": z.coerce.date().nullable().optional()
  }).strict().refine((o) => Object.keys(o || {}).length >= 1, { message: "Object must have at least 1 key(s)" }).optional(),
  "params": z.object({

  }).passthrough().optional()
}).passthrough().passthrough();
