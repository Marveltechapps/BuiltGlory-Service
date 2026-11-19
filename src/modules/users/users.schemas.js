import { z } from "zod";

/** Auto-generated from users.validation.js (Joi → Zod). Review nested refinements as needed. */

export const submitKycSchema = z.object({
  body: z.object({
    documents: z.array(z.object({
      documentId: z.string().regex(/^[a-fA-F0-9]{24}$/),
      type: z.enum(["pan", "aadhaar", "passport", "oci_card", "visa", "address_proof", "other"])
    })).min(1).max(10)
  }).strict()
}).passthrough();

export const accountDeletionRequestSchema = z.object({
  "body": z.object({
    "confirmation": z.enum(["DELETE"]),
    "reason": z.union([z.string().max(1000).nullable(), z.literal("")]).optional()
  }).strict().optional()
}).passthrough().passthrough();

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
    "sort": z.enum(["newest", "oldest"]).optional(),
    "role": z.enum(["buyer", "seller", "both"]).optional(),
    "userType": z.enum(["resident", "nri", "pio"]).optional(),
    "kycStatus": z.enum(["not_submitted", "pending", "verified", "rejected"]).optional(),
    "isBlocked": z.coerce.boolean().optional(),
    "isActive": z.coerce.boolean().optional(),
    "assignedTo": z.string().regex(/^[a-fA-F0-9]{24}$/).optional()
  }).strict().optional()
}).passthrough().passthrough();

export const pushTokenSchema = z.object({
  "body": z.object({
    "token": z.string().min(20).max(4096),
    "platform": z.enum(["android", "ios", "web"]).default("android"),
    "deviceId": z.union([z.string().max(200).nullable(), z.literal("")]).optional()
  }).strict().optional()
}).passthrough().passthrough();

export const removePushTokenSchema = z.object({
  "body": z.object({
    "token": z.string().min(20).max(4096)
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
    "name": z.string().min(2).max(120).optional(),
    "email": z.union([z.string().email().nullable(), z.literal("")]).optional(),
    "phone": z.union([z.string().max(24).nullable(), z.literal("")]).optional(),
    "phoneNormalized": z.union([z.string().regex(new RegExp("^\\d{10,15}$", "")).nullable(), z.literal("")]).optional(),
    "mobileNumber": z.union([z.string().regex(new RegExp("^\\d{10}$", "")).nullable(), z.literal("")]).optional(),
    "city": z.union([z.string().max(80).nullable(), z.literal("")]).optional(),
    "state": z.union([z.string().max(80).nullable(), z.literal("")]).optional(),
    "country": z.union([z.string().max(80).nullable(), z.literal("")]).optional(),
    "latitude": z.coerce.number().min(-90).max(90).nullable().optional(),
    "longitude": z.coerce.number().min(-180).max(180).nullable().optional(),
    "profilePhoto": z.union([z.string().url().nullable(), z.literal("")]).optional(),
    "userType": z.enum(["resident", "nri", "pio"]).optional(),
    "role": z.enum(["buyer", "seller", "both"]).optional(),
    "bankDetails": z.object({
      "accountHolderName": z.string().min(2).max(120),
      "bankName": z.string().min(2).max(120),
      "accountNumberLast4": z.string().regex(new RegExp("^\\d{4}$", "")),
      "ifsc": z.string().min(6).max(20),
      "branch": z.union([z.string().max(120).nullable(), z.literal("")]).optional(),
      "upiId": z.union([z.string().max(120).nullable(), z.literal("")]).optional(),
      "updatedAt": z.coerce.date().optional()
    }).strict().optional(),
    "notificationPreferences": z.object({
      "sms": z.object({
        "transactional": z.coerce.boolean().optional(),
        "marketing": z.coerce.boolean().optional()
      }).strict().refine((o) => Object.keys(o || {}).length >= 1, { message: "Object must have at least 1 key(s)" }).optional(),
      "whatsapp": z.object({
        "transactional": z.coerce.boolean().optional(),
        "marketing": z.coerce.boolean().optional()
      }).strict().refine((o) => Object.keys(o || {}).length >= 1, { message: "Object must have at least 1 key(s)" }).optional(),
      "email": z.object({
        "transactional": z.coerce.boolean().optional(),
        "marketing": z.coerce.boolean().optional()
      }).strict().refine((o) => Object.keys(o || {}).length >= 1, { message: "Object must have at least 1 key(s)" }).optional(),
      "push": z.object({
        "transactional": z.coerce.boolean().optional(),
        "marketing": z.coerce.boolean().optional()
      }).strict().refine((o) => Object.keys(o || {}).length >= 1, { message: "Object must have at least 1 key(s)" }).optional(),
      "in_app": z.object({
        "transactional": z.coerce.boolean().optional(),
        "marketing": z.coerce.boolean().optional()
      }).strict().refine((o) => Object.keys(o || {}).length >= 1, { message: "Object must have at least 1 key(s)" }).optional()
    }).strict().refine((o) => Object.keys(o || {}).length >= 1, { message: "Object must have at least 1 key(s)" }).optional(),
    "preferences": z.object({
      "language": z.enum(["en", "ta", "hi", "kn", "English", "Tamil", "Hindi", "Kannada"])
    }).strict().optional(),
    "privacy": z.object({
      "personalise": z.coerce.boolean().optional(),
      "shareWithSellers": z.coerce.boolean().optional(),
      "analytics": z.coerce.boolean().optional(),
      "location": z.coerce.boolean().optional()
    }).strict().refine((o) => Object.keys(o || {}).length >= 1, { message: "Object must have at least 1 key(s)" }).optional(),
    "isBlocked": z.coerce.boolean().optional(),
    "blockedReason": z.union([z.string().max(500).nullable(), z.literal("")]).optional(),
    "assignedTo": z.union([z.string().regex(/^[a-fA-F0-9]{24}$/).nullable(), z.literal("")]).optional(),
    "status": z.enum(["not_submitted", "pending", "verified", "rejected", "not_checked", "compliant", "non_compliant", "under_review"]).optional(),
    "documentUpdates": z.array(z.object({
      "documentId": z.string(),
      "status": z.enum(["missing", "uploaded", "verified", "rejected", "expired"]),
      "rejectionReason": z.union([z.string().nullable(), z.literal("")]).optional()
    }).passthrough()).optional(),
    "notes": z.union([z.string().max(2000).nullable(), z.literal("")]).optional()
  }).strict().refine((o) => Object.keys(o || {}).length >= 1, { message: "Object must have at least 1 key(s)" }).optional(),
  "params": z.object({

  }).passthrough().optional()
}).passthrough().passthrough();
