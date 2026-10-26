import Joi from "joi";
export const idParam = Joi.object({ params: Joi.object({ id: Joi.string().hex().length(24) }).unknown(true) }).unknown(true);
export const listValidator = Joi.object({ query: Joi.object({ page: Joi.number().integer().min(1), limit: Joi.number().integer().min(1).max(100), search: Joi.string().max(100), sort: Joi.string().max(40) }).unknown(true) }).unknown(true);
export const createValidator = Joi.object({ body: Joi.object().min(1).unknown(true) }).unknown(true);
export const updateValidator = Joi.object({
  body: Joi.object({
    status: Joi.string().valid("new", "contacted", "quote_sent", "negotiating", "accepted", "completed", "declined"),
    assignedDesigner: Joi.string().hex().length(24).allow(null),
    notes: Joi.string().max(4000).allow("", null),
    remoteCoordinationNotes: Joi.string().max(4000).allow("", null),
    selectedRooms: Joi.array().items(Joi.string().max(80)).max(30),
    designStyle: Joi.string().valid("modern", "classic", "contemporary", "minimalist"),
    budgetRange: Joi.string().valid("budget", "standard", "premium", "luxury"),
    userType: Joi.string().max(40),
    quote: Joi.object({
      amount: Joi.number().positive(),
      packageName: Joi.string().max(200),
      timeline: Joi.string().max(200),
      inclusions: Joi.array().items(Joi.string().max(200)),
      validUntil: Joi.date().iso()
    }),
    customerAcceptedAt: Joi.date().iso(),
    completionNote: Joi.string().max(4000).allow("", null)
  }).min(1).unknown(false),
  params: Joi.object().unknown(true)
}).unknown(true);
export const statusValidator = Joi.object({ body: Joi.object({ status: Joi.string(), stage: Joi.string(), decision: Joi.string(), notes: Joi.string().allow("", null), reason: Joi.string().allow("", null) }).unknown(true), params: Joi.object().unknown(true) }).unknown(true);