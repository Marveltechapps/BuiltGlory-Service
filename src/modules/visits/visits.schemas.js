import { z } from "zod";

/** Auto-generated from visits.validation.js (Joi → Zod). Review nested refinements as needed. */

export const adminCreateSchema = z.object({
  "body": z.object({
    "buyerId": z.string().regex(/^[a-fA-F0-9]{24}$/),
    "propertyId": z.string().regex(/^[a-fA-F0-9]{24}$/),
    "enquiryId": z.string().regex(/^[a-fA-F0-9]{24}$/).optional(),
    "visitDate": z.coerce.date(),
    "visitTime": z.string().max(40),
    "visitType": z.enum(["physical", "virtual"]),
    "meetingLink": z.union([z.string().url().nullable(), z.literal("")]).optional(),
    "virtualPlatform": z.union([z.enum(["zoom", "google_meet", "teams", "whatsapp_video"]), z.null()]).nullable().optional(),
    "assignedAdmin": z.string().regex(/^[a-fA-F0-9]{24}$/).optional(),
    "preferredLanguage": z.union([z.enum(["English", "Tamil", "Hindi", "Kannada"]), z.null()]).nullable().optional(),
    "language": z.union([z.string().max(40).nullable(), z.literal("")]).optional()
  }).strict().optional()
}).passthrough().passthrough();

export const availabilitySchema = z.object({
  "query": z.object({
    "propertyId": z.string().regex(/^[a-fA-F0-9]{24}$/),
    "visitType": z.enum(["physical", "virtual"]).default("physical"),
    "from": z.coerce.date().optional(),
    "days": z.coerce.number().int().min(1).max(30).default(7)
  }).strict().optional()
}).passthrough().passthrough();

export const createSchema = z.object({
  "body": z.object({
    "propertyId": z.string().regex(/^[a-fA-F0-9]{24}$/),
    "enquiryId": z.string().regex(/^[a-fA-F0-9]{24}$/).optional(),
    "visitDate": z.coerce.date(),
    "visitTime": z.string().max(40),
    "visitType": z.enum(["physical", "virtual"]),
    "preferredLanguage": z.union([z.enum(["English", "Tamil", "Hindi", "Kannada"]), z.null()]).nullable().optional(),
    "language": z.union([z.string().max(40).nullable(), z.literal("")]).optional(),
    "virtualPlatform": z.union([z.enum(["zoom", "google_meet", "teams", "whatsapp_video"]), z.null()]).nullable().optional(),
    "meetingLink": z.union([z.string().url().nullable(), z.literal("")]).optional()
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
    "status": z.enum(["scheduled", "confirmed", "completed", "cancelled", "missed", "rescheduled"]).optional(),
    "visitType": z.enum(["physical", "virtual"]).optional(),
    "assignedAdmin": z.string().regex(/^[a-fA-F0-9]{24}$/).optional(),
    "buyerId": z.string().regex(/^[a-fA-F0-9]{24}$/).optional(),
    "propertyId": z.string().regex(/^[a-fA-F0-9]{24}$/).optional()
  }).strict().optional()
}).passthrough().passthrough();

export const statusSchema = z.object({
  "body": z.object({
    "status": z.enum(["scheduled", "confirmed", "completed", "cancelled", "missed", "rescheduled"]),
    "visitDate": z.coerce.date().optional(),
    "visitTime": z.string().max(40).optional(),
    "notes": z.union([z.string().nullable(), z.literal("")]).optional(),
    "reason": z.union([z.string().nullable(), z.literal("")]).optional(),
    "cancelReason": z.union([z.string().nullable(), z.literal("")]).optional(),
    "meetingLink": z.union([z.string().url().nullable(), z.literal("")]).optional(),
    "virtualPlatform": z.union([z.enum(["zoom", "google_meet", "teams", "whatsapp_video"]), z.null()]).nullable().optional(),
    "assignedAdmin": z.string().regex(/^[a-fA-F0-9]{24}$/).optional(),
    "feedback": z.object({
      "buyerInterest": z.enum(["very_interested", "interested", "not_interested", "needs_time"]),
      "notes": z.string().max(2000),
      "nextAction": z.enum(["move_to_negotiation", "schedule_another_visit", "mark_lost", "follow_up"])
    }).passthrough().optional(),
    "virtualRecordingUrl": z.union([z.string().url().nullable(), z.literal("")]).optional(),
    "callDuration": z.coerce.number().int().min(0).nullable().optional(),
    "callNotes": z.union([z.string().max(2000).nullable(), z.literal("")]).optional(),
    "documentsShared": z.array(z.string().max(160)).max(50).optional(),
    "followUpAction": z.union([z.string().max(160).nullable(), z.literal("")]).optional(),
    "followUpDate": z.coerce.date().nullable().optional(),
    "completedAt": z.coerce.date().nullable().optional(),
    "nriChecklist": z.object({

    }).passthrough().optional(),
    "nriAssistanceNotes": z.union([z.string().max(4000).nullable(), z.literal("")]).optional(),
    "reminderSent": z.coerce.boolean().optional(),
    "callLog": z.object({
      "outcome": z.union([z.string().max(80).nullable(), z.literal("")]).optional(),
      "notes": z.union([z.string().max(2000).nullable(), z.literal("")]).optional(),
      "duration": z.coerce.number().int().min(0).optional(),
      "calledAt": z.coerce.date().optional()
    }).passthrough().optional(),
    "note": z.object({
      "text": z.string().max(2000)
    }).passthrough().optional(),
    "visitNotes": z.array(z.object({
      "text": z.string().max(2000),
      "createdAt": z.coerce.date().optional()
    }).passthrough()).max(100).optional()
  }).strict().optional(),
  "params": z.object({

  }).passthrough().optional()
}).passthrough().passthrough();

export const updateSchema = z.object({
  "body": z.object({
    "visitDate": z.coerce.date().optional(),
    "visitTime": z.string().max(40).optional(),
    "reason": z.union([z.string().max(500).nullable(), z.literal("")]).optional(),
    "meetingLink": z.union([z.string().url().nullable(), z.literal("")]).optional(),
    "virtualPlatform": z.union([z.enum(["zoom", "google_meet", "teams", "whatsapp_video"]), z.null()]).nullable().optional(),
    "feedback": z.object({
      "buyerInterest": z.enum(["very_interested", "interested", "not_interested", "needs_time"]),
      "notes": z.string().max(2000),
      "nextAction": z.enum(["move_to_negotiation", "schedule_another_visit", "mark_lost", "follow_up"])
    }).passthrough().optional(),
    "outcome": z.string().max(80).optional(),
    "notes": z.union([z.string().max(2000).nullable(), z.literal("")]).optional()
  }).strict().refine((o) => Object.keys(o || {}).length >= 1, { message: "Object must have at least 1 key(s)" }).optional(),
  "params": z.object({

  }).passthrough().optional()
}).passthrough().passthrough();
