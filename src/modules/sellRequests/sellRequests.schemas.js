import { z } from "zod";
import { booleanish } from "../../utils/zodHelpers.js";

/** Auto-generated from sellRequests.validation.js (Joi → Zod). Review nested refinements as needed. */

export const adminUpdateSchema = z.object({
  "body": z.object({
    "assignedTo": z.string().regex(/^[a-fA-F0-9]{24}$/).nullable().optional()
  }).strict().refine((o) => Object.keys(o || {}).length >= 1, { message: "Object must have at least 1 key(s)" }).optional(),
  "params": z.object({

  }).passthrough().optional()
}).passthrough().passthrough();

export const createSchema = z.object({
  "body": z.object({
    "propertyType": z.enum(["plot", "apartment", "residential", "commercial", "organic_home", "3d_printing", "fractional", "ceo_mansion", "holiday_home", "land", "farmhouse", "nri", "interior", "villa", "flat", "flats", "3d-print", "3d_print", "organic", "ceo-mansion", "ceo", "holiday", "farm", "house"]).optional(),
    "propertyTitle": z.union([z.string().max(200), z.literal("")]).optional(),
    "askingPrice": z.coerce.number().positive().min(50000).max(50000000000).optional(),
    "negotiable": booleanish.optional(),
    "address": z.object({
      "street": z.union([z.string().min(1).max(120).nullable(), z.literal("")]).optional(),
      "locality": z.union([z.string().min(1).max(80).nullable(), z.literal("")]).optional(),
      "city": z.union([z.string().min(1).max(80).nullable(), z.literal("")]).optional(),
      "state": z.union([z.string().min(1).max(80).nullable(), z.literal("")]).optional(),
      "pincode": z.union([z.string().regex(new RegExp("^\\d{6}$", "")).nullable(), z.literal("")]).optional(),
      "landmark": z.union([z.string().min(1).max(120).nullable(), z.literal("")]).optional(),
      "latitude": z.coerce.number().min(-90).max(90).optional(),
      "longitude": z.coerce.number().min(-180).max(180).optional()
    }).passthrough().optional(),
    "specifications": z.object({
      "subType": z.union([z.string().min(1).max(80).nullable(), z.literal("")]).optional(),
      "title": z.union([z.string().min(1).max(200).nullable(), z.literal("")]).optional(),
      "bhk": z.union([z.string().min(1).max(20).nullable(), z.literal("")]).optional(),
      "builtUpArea": z.coerce.number().positive().min(50).max(1000000).nullable().optional(),
      "plotArea": z.coerce.number().positive().min(50).max(1000000).nullable().optional(),
      "area": z.coerce.number().positive().min(50).max(1000000).nullable().optional(),
      "totalArea": z.coerce.number().positive().min(50).max(1000000).nullable().optional(),
      "carpetArea": z.coerce.number().positive().min(50).max(1000000).nullable().optional(),
      "floor": z.union([z.string().max(20), z.coerce.number().min(-5).max(200)]).nullable().optional(),
      "totalFloors": z.coerce.number().int().min(1).max(200).nullable().optional(),
      "floors": z.coerce.number().int().min(1).max(200).nullable().optional(),
      "unitNo": z.union([z.string().min(1).max(40).nullable(), z.literal("")]).optional(),
      "unitNumber": z.union([z.string().min(1).max(40).nullable(), z.literal("")]).optional(),
      "age": z.union([z.string().min(1).max(40).nullable(), z.literal("")]).optional(),
      "propertyAge": z.union([z.string().min(1).max(40).nullable(), z.literal("")]).optional(),
      "facing": z.union([z.string().min(1).max(40).nullable(), z.literal("")]).optional(),
      "furnishing": z.union([z.string().min(1).max(40).nullable(), z.literal("")]).optional(),
      "furnish": z.union([z.string().min(1).max(40).nullable(), z.literal("")]).optional(),
      "furnishDetails": z.union([z.string().min(1).max(500).nullable(), z.literal("")]).optional(),
      "parking": z.coerce.number().min(0).max(50).nullable().optional(),
      "parkingCount": z.coerce.number().min(0).max(50).nullable().optional(),
      "parkingType": z.union([z.string().min(1).max(40).nullable(), z.literal("")]).optional(),
      "commercialType": z.union([z.string().min(1).max(40).nullable(), z.literal("")]).optional(),
      "reraNumber": z.union([z.string().min(1).max(40).nullable(), z.literal("")]).optional(),
      "rera": z.union([z.string().min(1).max(40).nullable(), z.literal("")]).optional(),
      "roadWidth": z.coerce.number().positive().min(3).max(200).nullable().optional(),
      "approvalType": z.union([z.string().min(1).max(40).nullable(), z.literal("")]).optional(),
      "countryOfResidence": z.union([z.string().min(1).max(80).nullable(), z.literal("")]).optional(),
      "poaHolderName": z.union([z.string().min(1).max(80).nullable(), z.literal("")]).optional(),
      "poaHolderPhone": z.union([z.string().regex(new RegExp("^[6-9]\\d{9}$", "")).nullable(), z.literal("")]).optional(),
      "poaHolderEmail": z.union([z.string().email().nullable(), z.literal("")]).optional(),
      "sharePercentage": z.coerce.number().positive().min(0.01).max(100).nullable().optional(),
      "totalPropertyValue": z.coerce.number().positive().min(50000).max(50000000000).nullable().optional(),
      "legalStructure": z.union([z.string().min(1).max(80).nullable(), z.literal("")]).optional(),
      "scopeOfWork": z.union([z.string().min(1).max(80).nullable(), z.literal("")]).optional(),
      "budgetRange": z.union([z.string().min(1).max(80).nullable(), z.literal("")]).optional(),
      "expectedStartDate": z.union([z.string().regex(new RegExp("^\\d{4}-\\d{2}-\\d{2}(?:T|$)", "")).nullable(), z.literal("")]).optional(),
      "virtualTourUrl": z.union([z.string().url().nullable(), z.literal("")]).optional()
    }).passthrough().optional(),
    "amenities": z.array(z.string().max(60)).optional(),
    "ownershipType": z.union([z.string().min(1).max(80).nullable(), z.literal("")]).optional(),
    "possessionStatus": z.union([z.string().min(1).max(80).nullable(), z.literal("")]).optional(),
    "loanOnProperty": booleanish.optional(),
    "loanDetails": z.object({
      "lender": z.union([z.string().min(1).max(80).nullable(), z.literal("")]).optional(),
      "outstanding": z.coerce.number().positive().max(50000000000).nullable().optional()
    }).passthrough().nullable().optional(),
    "description": z.union([z.string().max(5000).nullable(), z.literal("")]).optional(),
    "photos": z.array(z.string()).max(30).optional(),
    "documents": z.array(z.object({

    }).passthrough()).optional(),
    "draftStep": z.coerce.number().int().min(1).max(7).optional(),
    "isDraft": booleanish.optional(),
    "status": z.enum(["draft", "new"]).optional()
  }).strict().refine((o) => Object.keys(o || {}).length >= 1, { message: "Object must have at least 1 key(s)" }).optional()
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
    "status": z.string().optional(),
    "assignedTo": z.string().regex(/^[a-fA-F0-9]{24}$/).optional(),
    "sellerId": z.string().regex(/^[a-fA-F0-9]{24}$/).optional(),
    "propertyType": z.string().optional(),
    "city": z.string().optional()
  }).strict().optional()
}).passthrough().passthrough();

export const offerDecisionSchema = z.object({
  "body": z.object({
    "decision": z.enum(["accepted", "countered"]),
    "counterAmount": z.any().optional(),
    "notes": z.union([z.string().max(1000).nullable(), z.literal("")]).optional()
  }).strict().optional(),
  "params": z.object({

  }).passthrough().optional()
}).passthrough().passthrough();

export const registrationConfirmSchema = z.object({
  "body": z.object({
    "documentsReady": z.array(z.string().max(200)).max(50).default([])
  }).strict().optional(),
  "params": z.object({

  }).passthrough().optional()
}).passthrough().passthrough();

export const sellerAvailabilitySchema = z.object({
  "body": z.object({
    "slots": z.array(z.string().max(40)).max(12)
  }).strict().optional(),
  "params": z.object({

  }).passthrough().optional()
}).passthrough().passthrough();

export const sellerMessageSchema = z.object({
  "body": z.object({
    "text": z.string().max(2000)
  }).strict().optional(),
  "params": z.object({

  }).passthrough().optional()
}).passthrough().passthrough();

export const sellerVisitActionSchema = z.object({
  "body": z.object({
    "action": z.enum(["confirm", "reschedule", "decline"]),
    "visitDate": z.any().optional(),
    "visitTime": z.any().optional(),
    "reason": z.union([z.string().max(500).nullable(), z.literal("")]).optional(),
    "meetingLink": z.union([z.string().url().nullable(), z.literal("")]).optional()
  }).strict().optional(),
  "params": z.object({

  }).passthrough().optional()
}).passthrough().passthrough();

export const statusSchema = z.object({
  "body": z.object({
    "decision": z.enum(["under_review", "changes_requested", "rejected", "accepted", "approved", "active", "negotiating", "paused", "sold"]),
    "notes": z.union([z.string().nullable(), z.literal("")]).optional(),
    "reason": z.union([z.string().nullable(), z.literal("")]).optional(),
    "rejectionReason": z.union([z.string().nullable(), z.literal("")]).optional(),
    "pauseReason": z.union([z.string().nullable(), z.literal("")]).optional(),
    "changeRequests": z.array(z.string()).optional(),
    "salePrice": z.coerce.number().positive().optional(),
    "saleDate": z.coerce.date().nullable().optional(),
    "saleBuyerName": z.union([z.string().nullable(), z.literal("")]).optional()
  }).strict().optional(),
  "params": z.object({

  }).passthrough().optional()
}).passthrough().passthrough();

export const updateSchema = z.object({
  "body": z.object({
    "propertyType": z.enum(["plot", "apartment", "residential", "commercial", "organic_home", "3d_printing", "fractional", "ceo_mansion", "holiday_home", "land", "farmhouse", "nri", "interior", "villa", "flat", "flats", "3d-print", "3d_print", "organic", "ceo-mansion", "ceo", "holiday", "farm", "house"]).optional(),
    "propertyTitle": z.union([z.string().max(200), z.literal("")]).optional(),
    "askingPrice": z.coerce.number().positive().min(50000).max(50000000000).optional(),
    "negotiable": booleanish.optional(),
    "address": z.object({
      "street": z.union([z.string().min(1).max(120).nullable(), z.literal("")]).optional(),
      "locality": z.union([z.string().min(1).max(80).nullable(), z.literal("")]).optional(),
      "city": z.union([z.string().min(1).max(80).nullable(), z.literal("")]).optional(),
      "state": z.union([z.string().min(1).max(80).nullable(), z.literal("")]).optional(),
      "pincode": z.union([z.string().regex(new RegExp("^\\d{6}$", "")).nullable(), z.literal("")]).optional(),
      "landmark": z.union([z.string().min(1).max(120).nullable(), z.literal("")]).optional(),
      "latitude": z.coerce.number().min(-90).max(90).optional(),
      "longitude": z.coerce.number().min(-180).max(180).optional()
    }).passthrough().optional(),
    "specifications": z.object({
      "subType": z.union([z.string().min(1).max(80).nullable(), z.literal("")]).optional(),
      "title": z.union([z.string().min(1).max(200).nullable(), z.literal("")]).optional(),
      "bhk": z.union([z.string().min(1).max(20).nullable(), z.literal("")]).optional(),
      "builtUpArea": z.coerce.number().positive().min(50).max(1000000).nullable().optional(),
      "plotArea": z.coerce.number().positive().min(50).max(1000000).nullable().optional(),
      "area": z.coerce.number().positive().min(50).max(1000000).nullable().optional(),
      "totalArea": z.coerce.number().positive().min(50).max(1000000).nullable().optional(),
      "carpetArea": z.coerce.number().positive().min(50).max(1000000).nullable().optional(),
      "floor": z.union([z.string().max(20), z.coerce.number().min(-5).max(200)]).nullable().optional(),
      "totalFloors": z.coerce.number().int().min(1).max(200).nullable().optional(),
      "floors": z.coerce.number().int().min(1).max(200).nullable().optional(),
      "unitNo": z.union([z.string().min(1).max(40).nullable(), z.literal("")]).optional(),
      "unitNumber": z.union([z.string().min(1).max(40).nullable(), z.literal("")]).optional(),
      "age": z.union([z.string().min(1).max(40).nullable(), z.literal("")]).optional(),
      "propertyAge": z.union([z.string().min(1).max(40).nullable(), z.literal("")]).optional(),
      "facing": z.union([z.string().min(1).max(40).nullable(), z.literal("")]).optional(),
      "furnishing": z.union([z.string().min(1).max(40).nullable(), z.literal("")]).optional(),
      "furnish": z.union([z.string().min(1).max(40).nullable(), z.literal("")]).optional(),
      "furnishDetails": z.union([z.string().min(1).max(500).nullable(), z.literal("")]).optional(),
      "parking": z.coerce.number().min(0).max(50).nullable().optional(),
      "parkingCount": z.coerce.number().min(0).max(50).nullable().optional(),
      "parkingType": z.union([z.string().min(1).max(40).nullable(), z.literal("")]).optional(),
      "commercialType": z.union([z.string().min(1).max(40).nullable(), z.literal("")]).optional(),
      "reraNumber": z.union([z.string().min(1).max(40).nullable(), z.literal("")]).optional(),
      "rera": z.union([z.string().min(1).max(40).nullable(), z.literal("")]).optional(),
      "roadWidth": z.coerce.number().positive().min(3).max(200).nullable().optional(),
      "approvalType": z.union([z.string().min(1).max(40).nullable(), z.literal("")]).optional(),
      "countryOfResidence": z.union([z.string().min(1).max(80).nullable(), z.literal("")]).optional(),
      "poaHolderName": z.union([z.string().min(1).max(80).nullable(), z.literal("")]).optional(),
      "poaHolderPhone": z.union([z.string().regex(new RegExp("^[6-9]\\d{9}$", "")).nullable(), z.literal("")]).optional(),
      "poaHolderEmail": z.union([z.string().email().nullable(), z.literal("")]).optional(),
      "sharePercentage": z.coerce.number().positive().min(0.01).max(100).nullable().optional(),
      "totalPropertyValue": z.coerce.number().positive().min(50000).max(50000000000).nullable().optional(),
      "legalStructure": z.union([z.string().min(1).max(80).nullable(), z.literal("")]).optional(),
      "scopeOfWork": z.union([z.string().min(1).max(80).nullable(), z.literal("")]).optional(),
      "budgetRange": z.union([z.string().min(1).max(80).nullable(), z.literal("")]).optional(),
      "expectedStartDate": z.union([z.string().regex(new RegExp("^\\d{4}-\\d{2}-\\d{2}(?:T|$)", "")).nullable(), z.literal("")]).optional(),
      "virtualTourUrl": z.union([z.string().url().nullable(), z.literal("")]).optional()
    }).passthrough().optional(),
    "amenities": z.array(z.string().max(60)).optional(),
    "ownershipType": z.union([z.string().min(1).max(80).nullable(), z.literal("")]).optional(),
    "possessionStatus": z.union([z.string().min(1).max(80).nullable(), z.literal("")]).optional(),
    "loanOnProperty": booleanish.optional(),
    "loanDetails": z.object({
      "lender": z.union([z.string().min(1).max(80).nullable(), z.literal("")]).optional(),
      "outstanding": z.coerce.number().positive().max(50000000000).nullable().optional()
    }).passthrough().nullable().optional(),
    "description": z.union([z.string().max(5000).nullable(), z.literal("")]).optional(),
    "photos": z.array(z.string()).max(30).optional(),
    "documents": z.array(z.object({

    }).passthrough()).optional(),
    "draftStep": z.coerce.number().int().min(1).max(7).optional(),
    "isDraft": booleanish.optional(),
    "status": z.enum(["draft", "new"]).optional(),
    "changeRequests": z.array(z.string()).optional(),
    "rejectionReason": z.union([z.string().nullable(), z.literal("")]).optional()
  }).strict().refine((o) => Object.keys(o || {}).length >= 1, { message: "Object must have at least 1 key(s)" }).optional(),
  "params": z.object({

  }).passthrough().optional()
}).passthrough().passthrough();

export const valuationEstimateSchema = z.object({
  "body": z.object({
    "propertyType": z.enum(["plot", "apartment", "residential", "commercial", "organic_home", "3d_printing", "fractional", "ceo_mansion", "holiday_home", "land", "farmhouse", "nri", "interior", "villa", "flat", "flats", "3d-print", "3d_print", "organic", "ceo-mansion", "ceo", "holiday", "farm", "house"]).optional(),
    "address": z.object({
      "street": z.union([z.string().min(1).max(120).nullable(), z.literal("")]).optional(),
      "locality": z.union([z.string().min(1).max(80).nullable(), z.literal("")]).optional(),
      "city": z.union([z.string().min(1).max(80).nullable(), z.literal("")]).optional(),
      "state": z.union([z.string().min(1).max(80).nullable(), z.literal("")]).optional(),
      "pincode": z.union([z.string().regex(new RegExp("^\\d{6}$", "")).nullable(), z.literal("")]).optional(),
      "landmark": z.union([z.string().min(1).max(120).nullable(), z.literal("")]).optional(),
      "latitude": z.coerce.number().min(-90).max(90).optional(),
      "longitude": z.coerce.number().min(-180).max(180).optional()
    }).passthrough().optional(),
    "specifications": z.object({
      "subType": z.union([z.string().min(1).max(80).nullable(), z.literal("")]).optional(),
      "title": z.union([z.string().min(1).max(200).nullable(), z.literal("")]).optional(),
      "bhk": z.union([z.string().min(1).max(20).nullable(), z.literal("")]).optional(),
      "builtUpArea": z.coerce.number().positive().min(50).max(1000000).nullable().optional(),
      "plotArea": z.coerce.number().positive().min(50).max(1000000).nullable().optional(),
      "area": z.coerce.number().positive().min(50).max(1000000).nullable().optional(),
      "totalArea": z.coerce.number().positive().min(50).max(1000000).nullable().optional(),
      "carpetArea": z.coerce.number().positive().min(50).max(1000000).nullable().optional(),
      "floor": z.union([z.string().max(20), z.coerce.number().min(-5).max(200)]).nullable().optional(),
      "totalFloors": z.coerce.number().int().min(1).max(200).nullable().optional(),
      "floors": z.coerce.number().int().min(1).max(200).nullable().optional(),
      "unitNo": z.union([z.string().min(1).max(40).nullable(), z.literal("")]).optional(),
      "unitNumber": z.union([z.string().min(1).max(40).nullable(), z.literal("")]).optional(),
      "age": z.union([z.string().min(1).max(40).nullable(), z.literal("")]).optional(),
      "propertyAge": z.union([z.string().min(1).max(40).nullable(), z.literal("")]).optional(),
      "facing": z.union([z.string().min(1).max(40).nullable(), z.literal("")]).optional(),
      "furnishing": z.union([z.string().min(1).max(40).nullable(), z.literal("")]).optional(),
      "furnish": z.union([z.string().min(1).max(40).nullable(), z.literal("")]).optional(),
      "furnishDetails": z.union([z.string().min(1).max(500).nullable(), z.literal("")]).optional(),
      "parking": z.coerce.number().min(0).max(50).nullable().optional(),
      "parkingCount": z.coerce.number().min(0).max(50).nullable().optional(),
      "parkingType": z.union([z.string().min(1).max(40).nullable(), z.literal("")]).optional(),
      "commercialType": z.union([z.string().min(1).max(40).nullable(), z.literal("")]).optional(),
      "reraNumber": z.union([z.string().min(1).max(40).nullable(), z.literal("")]).optional(),
      "rera": z.union([z.string().min(1).max(40).nullable(), z.literal("")]).optional(),
      "roadWidth": z.coerce.number().positive().min(3).max(200).nullable().optional(),
      "approvalType": z.union([z.string().min(1).max(40).nullable(), z.literal("")]).optional(),
      "countryOfResidence": z.union([z.string().min(1).max(80).nullable(), z.literal("")]).optional(),
      "poaHolderName": z.union([z.string().min(1).max(80).nullable(), z.literal("")]).optional(),
      "poaHolderPhone": z.union([z.string().regex(new RegExp("^[6-9]\\d{9}$", "")).nullable(), z.literal("")]).optional(),
      "poaHolderEmail": z.union([z.string().email().nullable(), z.literal("")]).optional(),
      "sharePercentage": z.coerce.number().positive().min(0.01).max(100).nullable().optional(),
      "totalPropertyValue": z.coerce.number().positive().min(50000).max(50000000000).nullable().optional(),
      "legalStructure": z.union([z.string().min(1).max(80).nullable(), z.literal("")]).optional(),
      "scopeOfWork": z.union([z.string().min(1).max(80).nullable(), z.literal("")]).optional(),
      "budgetRange": z.union([z.string().min(1).max(80).nullable(), z.literal("")]).optional(),
      "expectedStartDate": z.union([z.string().regex(new RegExp("^\\d{4}-\\d{2}-\\d{2}(?:T|$)", "")).nullable(), z.literal("")]).optional(),
      "virtualTourUrl": z.union([z.string().url().nullable(), z.literal("")]).optional()
    }).passthrough().optional(),
    "amenities": z.array(z.string().max(60)).optional(),
    "askingPrice": z.coerce.number().positive().min(50000).max(50000000000).optional()
  }).strict().optional(),
  "params": z.object({

  }).passthrough().optional()
}).passthrough().passthrough();
