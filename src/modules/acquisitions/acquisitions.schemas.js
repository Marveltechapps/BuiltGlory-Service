import { z } from "zod";

/** Auto-generated from acquisitions.validation.js (Joi → Zod). Review nested refinements as needed. */

export const createSchema = z.object({
  "body": z.object({
    "sellRequestId": z.string().regex(/^[a-fA-F0-9]{24}$/).optional(),
    "createdFrom": z.enum(["sell_request", "manual"]).optional(),
    "assignedTo": z.union([z.string().regex(/^[a-fA-F0-9]{24}$/), z.any().nullable()]).optional(),
    "priority": z.enum(["normal", "high", "urgent"]).optional(),
    "builtgloryOffer": z.coerce.number().positive().max(1000000000000).nullable().optional(),
    "agreedPrice": z.coerce.number().positive().max(1000000000000).nullable().optional(),
    "finalPurchasePrice": z.coerce.number().positive().max(1000000000000).nullable().optional(),
    "rejectionReason": z.union([z.string().min(0).max(500).nullable(), z.literal("")]).optional(),
    "onHoldReason": z.union([z.string().min(0).max(500).nullable(), z.literal("")]).optional(),
    "notes": z.union([z.string().min(0).max(2000).nullable(), z.literal("")]).optional(),
    "valuation": z.object({
      "amount": z.coerce.number().positive().max(1000000000000).optional(),
      "marketValue": z.coerce.number().positive().max(1000000000000).optional(),
      "builtgloryValuation": z.coerce.number().positive().max(1000000000000).optional(),
      "valuedBy": z.union([z.string().min(1).max(120).nullable(), z.literal("")]).optional(),
      "valuationDate": z.union([z.string().max(40).nullable(), z.literal("")]).optional(),
      "comparables": z.union([z.string().min(0).max(2000).nullable(), z.literal("")]).optional(),
      "notes": z.union([z.string().min(0).max(2000).nullable(), z.literal("")]).optional(),
      "reportFileName": z.union([z.string().min(0).max(260).nullable(), z.literal("")]).optional(),
      "inspectionSummary": z.object({

      }).passthrough().optional(),
      "siteInspection": z.object({

      }).passthrough().optional()
    }).passthrough().optional(),
    "negotiation": z.object({
      "agreedPrice": z.coerce.number().positive().max(1000000000000).optional(),
      "offers": z.array(z.object({

      }).passthrough()).optional(),
      "notes": z.union([z.string().min(0).max(2000).nullable(), z.literal("")]).optional()
    }).passthrough().optional(),
    "token": z.object({
      "paid": z.coerce.boolean().optional(),
      "amount": z.coerce.number().min(0).max(1000000000000).optional(),
      "payment": z.object({
        "amount": z.coerce.number().positive().max(1000000000000),
        "method": z.enum(["cash", "neft", "upi", "cheque"]),
        "paymentDate": z.string().max(40),
        "reference": z.union([z.string().min(0).max(80).nullable(), z.literal("")]).optional(),
        "proofUrl": z.union([z.string().max(2000).nullable(), z.literal("")]).optional(),
        "notes": z.union([z.string().min(0).max(2000).nullable(), z.literal("")]).optional()
      }).passthrough().optional()
    }).passthrough().optional(),
    "documentation": z.object({

    }).passthrough().optional(),
    "payout": z.object({
      "completed": z.coerce.boolean().optional(),
      "amount": z.coerce.number().min(0).max(1000000000000).optional(),
      "method": z.union([z.string().max(40).nullable(), z.literal("")]).optional(),
      "notes": z.union([z.string().min(0).max(2000).nullable(), z.literal("")]).optional()
    }).passthrough().optional(),
    "propertyDetails": z.object({

    }).passthrough().optional()
  }).passthrough().refine((o) => Object.keys(o || {}).length >= 1, { message: "Object must have at least 1 key(s)" }).optional()
}).passthrough().passthrough();

export const idParam = z.object({
  "params": z.object({
    "id": z.string().regex(/^[a-fA-F0-9]{24}$/).optional(),
    "acquisitionId": z.string().regex(/^[a-fA-F0-9]{24}$/).optional()
  }).passthrough().optional()
}).passthrough().passthrough();

export const listSchema = z.object({
  "query": z.object({
    "page": z.coerce.number().int().min(1).optional(),
    "limit": z.coerce.number().int().min(1).max(100).optional(),
    "search": z.union([z.string().max(100), z.literal("")]).optional(),
    "sort": z.enum(["newest", "oldest", "price_asc", "price_desc"]).optional(),
    "stage": z.enum(["pending_review", "site_inspection", "valuation", "negotiation", "token_to_seller", "documentation", "seller_payout", "acquired", "rejected", "on_hold"]).optional(),
    "priority": z.enum(["normal", "high", "urgent"]).optional()
  }).passthrough().optional()
}).passthrough().passthrough();

export const statusSchema = z.object({
  "body": z.object({
    "status": z.string().max(40).optional(),
    "stage": z.enum(["pending_review", "site_inspection", "valuation", "negotiation", "token_to_seller", "documentation", "seller_payout", "acquired", "rejected", "on_hold"]).optional(),
    "decision": z.string().max(40).optional(),
    "notes": z.union([z.string().min(0).max(2000).nullable(), z.literal("")]).optional(),
    "reason": z.union([z.string().min(0).max(500).nullable(), z.literal("")]).optional(),
    "rejectionReason": z.union([z.string().min(0).max(500).nullable(), z.literal("")]).optional(),
    "onHoldReason": z.union([z.string().min(0).max(500).nullable(), z.literal("")]).optional(),
    "assignedTo": z.union([z.string().regex(/^[a-fA-F0-9]{24}$/), z.any().nullable()]).optional(),
    "priority": z.enum(["normal", "high", "urgent"]).optional(),
    "builtgloryOffer": z.coerce.number().positive().max(1000000000000).nullable().optional(),
    "agreedPrice": z.coerce.number().positive().max(1000000000000).nullable().optional(),
    "finalPurchasePrice": z.coerce.number().positive().max(1000000000000).nullable().optional(),
    "valuation": z.object({
      "amount": z.coerce.number().positive().max(1000000000000).optional(),
      "marketValue": z.coerce.number().positive().max(1000000000000).optional(),
      "builtgloryValuation": z.coerce.number().positive().max(1000000000000).optional(),
      "valuedBy": z.union([z.string().min(1).max(120).nullable(), z.literal("")]).optional(),
      "valuationDate": z.union([z.string().max(40).nullable(), z.literal("")]).optional(),
      "comparables": z.union([z.string().min(0).max(2000).nullable(), z.literal("")]).optional(),
      "notes": z.union([z.string().min(0).max(2000).nullable(), z.literal("")]).optional(),
      "reportFileName": z.union([z.string().min(0).max(260).nullable(), z.literal("")]).optional(),
      "inspectionSummary": z.object({

      }).passthrough().optional(),
      "siteInspection": z.object({

      }).passthrough().optional()
    }).passthrough().optional(),
    "negotiation": z.object({
      "agreedPrice": z.coerce.number().positive().max(1000000000000).optional(),
      "offers": z.array(z.object({

      }).passthrough()).optional(),
      "notes": z.union([z.string().min(0).max(2000).nullable(), z.literal("")]).optional()
    }).passthrough().optional(),
    "token": z.object({
      "paid": z.coerce.boolean().optional(),
      "amount": z.coerce.number().min(0).max(1000000000000).optional(),
      "payment": z.object({
        "amount": z.coerce.number().positive().max(1000000000000),
        "method": z.enum(["cash", "neft", "upi", "cheque"]),
        "paymentDate": z.string().max(40),
        "reference": z.union([z.string().min(0).max(80).nullable(), z.literal("")]).optional(),
        "proofUrl": z.union([z.string().max(2000).nullable(), z.literal("")]).optional(),
        "notes": z.union([z.string().min(0).max(2000).nullable(), z.literal("")]).optional()
      }).passthrough().optional()
    }).passthrough().optional(),
    "documentation": z.object({

    }).passthrough().optional(),
    "payout": z.object({
      "completed": z.coerce.boolean().optional(),
      "amount": z.coerce.number().min(0).max(1000000000000).optional(),
      "method": z.union([z.string().max(40).nullable(), z.literal("")]).optional(),
      "notes": z.union([z.string().min(0).max(2000).nullable(), z.literal("")]).optional()
    }).passthrough().optional(),
    "propertyDetails": z.object({

    }).passthrough().optional()
  }).passthrough().optional(),
  "params": z.object({
    "id": z.string().regex(/^[a-fA-F0-9]{24}$/).optional(),
    "acquisitionId": z.string().regex(/^[a-fA-F0-9]{24}$/).optional()
  }).passthrough().optional()
}).passthrough().passthrough();

export const updateSchema = z.object({
  "body": z.object({
    "assignedTo": z.union([z.string().regex(/^[a-fA-F0-9]{24}$/), z.any().nullable()]).optional(),
    "priority": z.enum(["normal", "high", "urgent"]).optional(),
    "builtgloryOffer": z.coerce.number().positive().max(1000000000000).nullable().optional(),
    "agreedPrice": z.coerce.number().positive().max(1000000000000).nullable().optional(),
    "finalPurchasePrice": z.coerce.number().positive().max(1000000000000).nullable().optional(),
    "rejectionReason": z.union([z.string().min(0).max(500).nullable(), z.literal("")]).optional(),
    "onHoldReason": z.union([z.string().min(0).max(500).nullable(), z.literal("")]).optional(),
    "notes": z.union([z.string().min(0).max(2000).nullable(), z.literal("")]).optional(),
    "valuation": z.object({
      "amount": z.coerce.number().positive().max(1000000000000).optional(),
      "marketValue": z.coerce.number().positive().max(1000000000000).optional(),
      "builtgloryValuation": z.coerce.number().positive().max(1000000000000).optional(),
      "valuedBy": z.union([z.string().min(1).max(120).nullable(), z.literal("")]).optional(),
      "valuationDate": z.union([z.string().max(40).nullable(), z.literal("")]).optional(),
      "comparables": z.union([z.string().min(0).max(2000).nullable(), z.literal("")]).optional(),
      "notes": z.union([z.string().min(0).max(2000).nullable(), z.literal("")]).optional(),
      "reportFileName": z.union([z.string().min(0).max(260).nullable(), z.literal("")]).optional(),
      "inspectionSummary": z.object({

      }).passthrough().optional(),
      "siteInspection": z.object({

      }).passthrough().optional()
    }).passthrough().optional(),
    "negotiation": z.object({
      "agreedPrice": z.coerce.number().positive().max(1000000000000).optional(),
      "offers": z.array(z.object({

      }).passthrough()).optional(),
      "notes": z.union([z.string().min(0).max(2000).nullable(), z.literal("")]).optional()
    }).passthrough().optional(),
    "token": z.object({
      "paid": z.coerce.boolean().optional(),
      "amount": z.coerce.number().min(0).max(1000000000000).optional(),
      "payment": z.object({
        "amount": z.coerce.number().positive().max(1000000000000),
        "method": z.enum(["cash", "neft", "upi", "cheque"]),
        "paymentDate": z.string().max(40),
        "reference": z.union([z.string().min(0).max(80).nullable(), z.literal("")]).optional(),
        "proofUrl": z.union([z.string().max(2000).nullable(), z.literal("")]).optional(),
        "notes": z.union([z.string().min(0).max(2000).nullable(), z.literal("")]).optional()
      }).passthrough().optional()
    }).passthrough().optional(),
    "documentation": z.object({

    }).passthrough().optional(),
    "payout": z.object({
      "completed": z.coerce.boolean().optional(),
      "amount": z.coerce.number().min(0).max(1000000000000).optional(),
      "method": z.union([z.string().max(40).nullable(), z.literal("")]).optional(),
      "notes": z.union([z.string().min(0).max(2000).nullable(), z.literal("")]).optional()
    }).passthrough().optional(),
    "propertyDetails": z.object({

    }).passthrough().optional()
  }).passthrough().refine((o) => Object.keys(o || {}).length >= 1, { message: "Object must have at least 1 key(s)" }).optional(),
  "params": z.object({
    "id": z.string().regex(/^[a-fA-F0-9]{24}$/).optional(),
    "acquisitionId": z.string().regex(/^[a-fA-F0-9]{24}$/).optional()
  }).passthrough().optional()
}).passthrough().passthrough();
