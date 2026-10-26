import Joi from "joi";
export const idParam = Joi.object({ params: Joi.object({ id: Joi.string().hex().length(24) }).unknown(true) }).unknown(true);
export const listValidator = Joi.object({ query: Joi.object({ page: Joi.number().integer().min(1), limit: Joi.number().integer().min(1).max(100), search: Joi.string().max(100), sort: Joi.string().max(40) }).unknown(true) }).unknown(true);
export const createValidator = Joi.object({ body: Joi.object().min(1).unknown(true) }).unknown(true);
export const updateValidator = Joi.object({
  body: Joi.object({
    name: Joi.string().max(120),
    email: Joi.string().email({ tlds: { allow: false } }),
    role: Joi.string().max(40),
    phone: Joi.string().max(30).allow("", null),
    photoUrl: Joi.string().uri().allow("", null),
    department: Joi.string().max(80).allow("", null),
    assignedArea: Joi.array().items(Joi.string().max(80)).max(30),
    specialization: Joi.array().items(Joi.string().max(80)).max(30),
    isAvailable: Joi.boolean(),
    isActive: Joi.boolean(),
    status: Joi.string().valid("active", "suspended", "invited"),
    permissions: Joi.array().items(Joi.string().max(80)).max(100)
  }).min(1).unknown(false),
  params: Joi.object().unknown(true)
}).unknown(true);
export const statusValidator = Joi.object({ body: Joi.object({ status: Joi.string(), stage: Joi.string(), decision: Joi.string(), notes: Joi.string().allow("", null), reason: Joi.string().allow("", null) }).unknown(true), params: Joi.object().unknown(true) }).unknown(true);