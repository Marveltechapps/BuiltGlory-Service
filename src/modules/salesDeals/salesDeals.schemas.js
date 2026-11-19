import { z } from "zod";
import { booleanish } from "../../utils/zodHelpers.js";

/** Auto-generated from salesDeals.validation.js (Joi → Zod). Review nested refinements as needed. */

export const closeSchema = z.object({
  "body": z.object({
    "notes": z.union([z.string().min(0).max(2000).nullable(), z.literal("")]).optional()
  }).passthrough().optional(),
  "params": z.object({
    "id": z.string().regex(/^[a-fA-F0-9]{24}$/).optional(),
    "dealId": z.string().regex(/^[a-fA-F0-9]{24}$/).optional()
  }).passthrough().optional()
}).passthrough().passthrough();

export const createSchema = z.object({
  "body": z.object({
    "buyerId": z.string().regex(/^[a-fA-F0-9]{24}$/),
    "propertyId": z.string().regex(/^[a-fA-F0-9]{24}$/),
    "sourceEnquiryId": z.string().regex(/^[a-fA-F0-9]{24}$/).optional(),
    "stage": z.enum(["active_leads", "site_visits", "negotiation", "token_payment", "full_payment", "stage_payment", "interior_design", "documentation", "closed", "lost", "re_engagement"]).optional(),
    "priority": z.enum(["normal", "high", "urgent"]).optional(),
    "assignedTo": z.union([z.string().regex(/^[a-fA-F0-9]{24}$/), z.any().nullable()]).optional(),
    "buyerSnapshot": z.object({
      "name": z.union([z.string().min(1).max(120).nullable(), z.literal("")]).optional(),
      "phone": z.union([z.string().min(1).max(20).nullable(), z.literal("")]).optional(),
      "email": z.union([z.string().email().nullable(), z.literal("")]).optional(),
      "userType": z.enum(["resident", "nri", "pio"]).optional()
    }).passthrough().optional(),
    "propertySnapshot": z.object({
      "title": z.union([z.string().min(1).max(200).nullable(), z.literal("")]).optional(),
      "type": z.union([z.string().min(1).max(40).nullable(), z.literal("")]).optional(),
      "location": z.union([z.string().min(1).max(200).nullable(), z.literal("")]).optional(),
      "price": z.coerce.number().positive().max(1000000000000).optional()
    }).passthrough().optional(),
    "financials": z.object({
      "offeredPrice": z.coerce.number().positive().max(1000000000000).nullable().optional(),
      "agreedPrice": z.coerce.number().positive().max(1000000000000).nullable().optional()
    }).passthrough().optional()
  }).passthrough().optional()
}).passthrough().passthrough();

export const idParam = z.object({
  "params": z.object({
    "id": z.string().regex(/^[a-fA-F0-9]{24}$/).optional(),
    "dealId": z.string().regex(/^[a-fA-F0-9]{24}$/).optional()
  }).passthrough().optional()
}).passthrough().passthrough();

export const listSchema = z.object({
  "query": z.object({
    "page": z.coerce.number().int().min(1).optional(),
    "limit": z.coerce.number().int().min(1).max(100).optional(),
    "search": z.union([z.string().max(100), z.literal("")]).optional(),
    "sort": z.enum(["newest", "oldest", "price_asc", "price_desc"]).optional(),
    "stage": z.enum(["active_leads", "site_visits", "negotiation", "token_payment", "full_payment", "stage_payment", "interior_design", "documentation", "closed", "lost", "re_engagement"]).optional(),
    "priority": z.enum(["normal", "high", "urgent"]).optional()
  }).passthrough().optional()
}).passthrough().passthrough();

export const statusSchema = z.object({
  "body": z.object({
    "status": z.string().max(40).optional(),
    "stage": z.enum(["active_leads", "site_visits", "negotiation", "token_payment", "full_payment", "stage_payment", "interior_design", "documentation", "closed", "lost", "re_engagement"]).optional(),
    "decision": z.string().max(40).optional(),
    "notes": z.union([z.string().min(0).max(2000).nullable(), z.literal("")]).optional(),
    "reason": z.union([z.string().min(0).max(500).nullable(), z.literal("")]).optional(),
    "lostReason": z.union([z.string().min(0).max(500).nullable(), z.literal("")]).optional(),
    "assignedTo": z.union([z.string().regex(/^[a-fA-F0-9]{24}$/), z.any().nullable()]).optional(),
    "priority": z.enum(["normal", "high", "urgent"]).optional(),
    "offeredPrice": z.coerce.number().positive().max(1000000000000).nullable().optional(),
    "agreedPrice": z.coerce.number().positive().max(1000000000000).nullable().optional(),
    "tokenAmount": z.coerce.number().min(0).max(1000000000000).nullable().optional(),
    "tokenPaid": booleanish.optional(),
    "tokenPayment": z.object({
      "amount": z.coerce.number().positive().max(1000000000000).optional(),
      "method": z.enum(["cash", "neft", "upi", "cheque"]).optional(),
      "paymentDate": z.string().max(40).optional(),
      "reference": z.union([z.string().min(0).max(80).nullable(), z.literal("")]).optional(),
      "proofUrl": z.union([z.string().max(2000).nullable(), z.literal("")]).optional(),
      "notes": z.union([z.string().min(0).max(2000).nullable(), z.literal("")]).optional()
    }).passthrough().nullable().optional(),
    "paymentType": z.union([z.enum(["full", "stage"]), z.null()]).nullable().optional(),
    "totalPaid": z.coerce.number().min(0).max(1000000000000).optional(),
    "fullPayment": z.object({

    }).passthrough().nullable().optional(),
    "stagePayment": z.object({

    }).passthrough().nullable().optional(),
    "interiorDesign": z.object({

    }).passthrough().nullable().optional(),
    "documentation": z.object({

    }).passthrough().optional(),
    "reengagement": z.object({
      "followUpAt": z.coerce.date().nullable().optional(),
      "lastContactAt": z.coerce.date().nullable().optional(),
      "attempts": z.coerce.number().int().min(0).max(100).optional()
    }).passthrough().optional(),
    "financials": z.object({

    }).passthrough().optional()
  }).passthrough().optional(),
  "params": z.object({
    "id": z.string().regex(/^[a-fA-F0-9]{24}$/).optional(),
    "dealId": z.string().regex(/^[a-fA-F0-9]{24}$/).optional()
  }).passthrough().optional()
}).passthrough().passthrough();

export const updateSchema = z.object({
  "body": z.object({
    "assignedTo": z.union([z.string().regex(/^[a-fA-F0-9]{24}$/), z.any().nullable()]).optional(),
    "priority": z.enum(["normal", "high", "urgent"]).optional(),
    "offeredPrice": z.coerce.number().positive().max(1000000000000).nullable().optional(),
    "agreedPrice": z.coerce.number().positive().max(1000000000000).nullable().optional(),
    "tokenAmount": z.coerce.number().min(0).max(1000000000000).nullable().optional(),
    "tokenPaid": booleanish.optional(),
    "tokenPayment": z.object({
      "amount": z.coerce.number().positive().max(1000000000000).optional(),
      "method": z.enum(["cash", "neft", "upi", "cheque"]).optional(),
      "paymentDate": z.string().max(40).optional(),
      "reference": z.union([z.string().min(0).max(80).nullable(), z.literal("")]).optional(),
      "proofUrl": z.union([z.string().max(2000).nullable(), z.literal("")]).optional(),
      "notes": z.union([z.string().min(0).max(2000).nullable(), z.literal("")]).optional()
    }).passthrough().nullable().optional(),
    "paymentType": z.union([z.enum(["full", "stage"]), z.null()]).nullable().optional(),
    "totalPaid": z.coerce.number().min(0).max(1000000000000).optional(),
    "fullPayment": z.object({

    }).passthrough().nullable().optional(),
    "stagePayment": z.object({

    }).passthrough().nullable().optional(),
    "interiorDesign": z.object({

    }).passthrough().nullable().optional(),
    "documentation": z.object({

    }).passthrough().optional(),
    "lostReason": z.union([z.string().min(0).max(500).nullable(), z.literal("")]).optional(),
    "notes": z.union([z.string().min(0).max(2000).nullable(), z.literal("")]).optional(),
    "reengagement": z.object({
      "followUpAt": z.coerce.date().nullable().optional(),
      "lastContactAt": z.coerce.date().nullable().optional(),
      "attempts": z.coerce.number().int().min(0).max(100).optional()
    }).passthrough().optional(),
    "financials": z.object({

    }).passthrough().optional()
  }).passthrough().refine((o) => Object.keys(o || {}).length >= 1, { message: "Object must have at least 1 key(s)" }).optional(),
  "params": z.object({
    "id": z.string().regex(/^[a-fA-F0-9]{24}$/).optional(),
    "dealId": z.string().regex(/^[a-fA-F0-9]{24}$/).optional()
  }).passthrough().optional()
}).passthrough().passthrough();
