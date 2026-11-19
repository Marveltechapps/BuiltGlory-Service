import { z } from "zod";

/** Auto-generated from adminSettings.validation.js (Joi → Zod). Review nested refinements as needed. */

export const updateSchema = z.object({
  "body": z.object({
    "organization": z.object({
      "name": z.string().max(120).optional(),
      "tagline": z.union([z.string().max(180), z.literal("")]).optional(),
      "email": z.union([z.string().email(), z.literal("")]).optional(),
      "phone": z.union([z.string().max(40), z.literal("")]).optional(),
      "address": z.union([z.string().max(500), z.literal("")]).optional(),
      "city": z.union([z.string().max(80), z.literal("")]).optional(),
      "state": z.union([z.string().max(80), z.literal("")]).optional(),
      "pincode": z.union([z.string().max(20), z.literal("")]).optional()
    }).strict().optional(),
    "app": z.object({
      "maintenance": z.coerce.boolean().optional(),
      "registration": z.coerce.boolean().optional(),
      "kycRequired": z.coerce.boolean().optional(),
      "showPrices": z.coerce.boolean().optional(),
      "virtualTours": z.coerce.boolean().optional(),
      "stagePayment": z.coerce.boolean().optional(),
      "interior": z.coerce.boolean().optional()
    }).strict().optional(),
    "sla": z.object({
      "interiorHours": z.coerce.number().int().min(1).max(168).optional(),
      "stagePaymentHours": z.coerce.number().int().min(1).max(168).optional(),
      "enquiryHours": z.coerce.number().int().min(1).max(168).optional(),
      "autoEscalate": z.coerce.boolean().optional(),
      "escalateToAdminId": z.string().regex(/^[a-fA-F0-9]{24}$/).nullable().optional(),
      "escalateToName": z.union([z.string().max(120), z.literal("")]).optional()
    }).strict().optional(),
    "alerts": z.object({
      "triggers": z.object({
        "slaBreached": z.coerce.boolean().optional(),
        "interiorInquiry": z.coerce.boolean().optional(),
        "stagePayment": z.coerce.boolean().optional(),
        "kycReview": z.coerce.boolean().optional(),
        "ticket48": z.coerce.boolean().optional(),
        "dailyEmail": z.coerce.boolean().optional(),
        "weeklyEmail": z.coerce.boolean().optional()
      }).strict().optional(),
      "email": z.union([z.string().email(), z.literal("")]).optional(),
      "whatsapp": z.union([z.string().max(40), z.literal("")]).optional()
    }).strict().optional(),
    "notifications": z.object({
      "contact": z.object({
        "phone": z.union([z.string().max(40), z.literal("")]).optional(),
        "email": z.union([z.string().email(), z.literal("")]).optional(),
        "ccEmail": z.union([z.string().email(), z.literal("")]).optional()
      }).strict().optional(),
      "email": z.object({
        "enquiry": z.coerce.boolean().optional(),
        "sell": z.coerce.boolean().optional(),
        "kyc": z.coerce.boolean().optional(),
        "user": z.coerce.boolean().optional(),
        "stageProof": z.coerce.boolean().optional(),
        "ticket": z.coerce.boolean().optional(),
        "daily": z.coerce.boolean().optional(),
        "weekly": z.coerce.boolean().optional()
      }).strict().optional(),
      "whatsapp": z.object({
        "enquiry": z.coerce.boolean().optional(),
        "slaBreached": z.coerce.boolean().optional()
      }).strict().optional()
    }).strict().optional(),
    "display": z.object({
      "timezone": z.enum(["IST", "GST", "SGT", "GMT", "EST", "PST"]).optional(),
      "dateFormat": z.enum(["DD MMM YYYY", "DD/MM/YYYY", "MMM DD, YYYY", "YYYY-MM-DD"]).optional(),
      "currencyFormat": z.enum(["indian", "international"]).optional()
    }).strict().optional(),
    "payment": z.object({
      "tokenAmount": z.coerce.number().int().min(0).optional(),
      "escrow": z.object({
        "accountHolder": z.union([z.string().max(120), z.literal("")]).optional(),
        "bankName": z.union([z.string().max(120), z.literal("")]).optional(),
        "accountNumber": z.union([z.string().max(80), z.literal("")]).optional(),
        "ifsc": z.union([z.string().max(30), z.literal("")]).optional(),
        "branch": z.union([z.string().max(160), z.literal("")]).optional(),
        "upiId": z.union([z.string().max(120), z.literal("")]).optional(),
        "chequePayee": z.union([z.string().max(120), z.literal("")]).optional(),
        "chequeInstructions": z.array(z.string().max(240)).max(10).optional()
      }).strict().optional()
    }).strict().optional(),
    "masterData": z.object({

    }).passthrough().optional(),
    "tools": z.object({
      "boostPlans": z.array(z.object({
        "id": z.string().max(80),
        "name": z.string().max(80),
        "priceLabel": z.union([z.string().max(80), z.literal("")]),
        "description": z.union([z.string().max(500), z.literal("")]),
        "benefits": z.array(z.string().max(160)).max(12),
        "active": z.coerce.boolean()
      }).strict()).max(20).optional(),
      "interiorPackages": z.array(z.object({
        "id": z.string().max(80),
        "name": z.string().max(80),
        "priceRange": z.union([z.string().max(80), z.literal("")]),
        "timeline": z.union([z.string().max(80), z.literal("")]),
        "active": z.coerce.boolean()
      }).strict()).max(50).optional(),
      "coupons": z.array(z.object({
        "id": z.string().max(80),
        "code": z.string().max(40),
        "discount": z.string().max(80),
        "type": z.enum(["% discount", "Flat discount"]),
        "appliesTo": z.string().max(80),
        "uses": z.union([z.string().max(80), z.literal("")]),
        "expiry": z.union([z.string().max(80), z.literal("")]),
        "active": z.coerce.boolean()
      }).strict()).max(200).optional()
    }).strict().optional()
  }).strict().refine((o) => Object.keys(o || {}).length >= 1, { message: "Object must have at least 1 key(s)" }).optional()
}).passthrough().passthrough();
