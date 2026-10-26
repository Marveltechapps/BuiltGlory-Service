import Joi from "joi";
export const idParam = Joi.object({ params: Joi.object({ id: Joi.string().hex().length(24) }).unknown(true) }).unknown(true);
export const listValidator = Joi.object({ query: Joi.object({ page: Joi.number().integer().min(1), limit: Joi.number().integer().min(1).max(100), search: Joi.string().max(100), sort: Joi.string().max(40) }).unknown(true) }).unknown(true);
export const createValidator = Joi.object({ body: Joi.object().min(1).unknown(true) }).unknown(true);
const messageBody = Joi.object({
  type: Joi.string().valid("text", "offer", "deal_agreed"),
  text: Joi.string().max(4000).allow("", null),
  offerAmount: Joi.number().positive(),
  notes: Joi.string().max(2000).allow("", null)
}).unknown(false);
const offerDecisionBody = Joi.object({
  decision: Joi.string().valid("accepted", "declined", "countered").required(),
  counterAmount: Joi.number().positive(),
  notes: Joi.string().max(2000).allow("", null)
}).unknown(false);
export const updateValidator = Joi.object({
  body: Joi.alternatives().try(offerDecisionBody, messageBody).required(),
  params: Joi.object().unknown(true)
}).unknown(true);
export const statusValidator = Joi.object({ body: Joi.object({ status: Joi.string(), stage: Joi.string(), decision: Joi.string(), notes: Joi.string().allow("", null), reason: Joi.string().allow("", null) }).unknown(true), params: Joi.object().unknown(true) }).unknown(true);