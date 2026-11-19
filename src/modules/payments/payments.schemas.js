import { z } from "zod";

/** Auto-generated from payments.validation.js (Joi → Zod). Review nested refinements as needed. */

export const createSchema = z.object({
  "body": z.object({
    "dealId": z.string().regex(/^[a-fA-F0-9]{24}$/),
    "propertyId": z.string().regex(/^[a-fA-F0-9]{24}$/).optional(),
    "type": z.enum(["token"]).default("token"),
    "amount": z.coerce.number().positive(),
    "currency": z.enum(["INR"]).default("INR"),
    "method": z.enum(["bank", "upi", "cheque", "cash"]).default("bank"),
    "transactionReference": z.union([z.string().max(80).nullable(), z.literal("")]).optional(),
    "proofDocumentId": z.union([z.string().regex(/^[a-fA-F0-9]{24}$/).nullable(), z.literal("")]).optional(),
    "notes": z.union([z.string().max(1000).nullable(), z.literal("")]).optional(),
    "idempotencyKey": z.string().max(120).optional(),
    "couponCode": z.string().trim().max(40).optional()
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
    "status": z.enum(["created", "pending", "paid", "failed", "refunded", "cancelled", "rejected"]).optional(),
    "type": z.enum(["token", "full", "stage", "seller_payout", "refund"]).optional(),
    "dealId": z.string().regex(/^[a-fA-F0-9]{24}$/).optional(),
    "method": z.enum(["bank", "upi", "cheque", "cash"]).optional()
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

  }).passthrough().refine((o) => Object.keys(o || {}).length >= 1, { message: "Object must have at least 1 key(s)" }).optional(),
  "params": z.object({

  }).passthrough().optional()
}).passthrough().passthrough();

export const refundSchema = z.object({
  "params": z.object({
    "paymentId": z.string().regex(/^[a-fA-F0-9]{24}$/)
  }).passthrough().optional(),
  "body": z.object({
    "transactionReference": z.string().trim().min(4).max(100),
    "notes": z.union([z.string().max(1000).nullable(), z.literal("")]).optional()
  }).strict().optional()
}).passthrough().passthrough();

export const verifySchema = z.object({
  "params": z.object({
    "paymentId": z.string().regex(/^[a-fA-F0-9]{24}$/)
  }).passthrough().optional(),
  "body": z.object({
    "decision": z.enum(["paid", "rejected"]),
    "notes": z.union([z.string().max(1000).nullable(), z.literal("")]).optional()
  }).strict().optional()
}).passthrough().passthrough();
