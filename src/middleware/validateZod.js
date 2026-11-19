import { ZodError } from "zod";
import { badRequest } from "../modules/error/index.js";

const mutate = (target, source) => {
  if (!source || typeof source !== "object" || target === source) return;
  // Merge parsed values onto the request object without dropping unspecified keys
  // (route params like :propertyId must survive schemas that only validate body).
  Object.assign(target, source);
};

/**
 * Zod validation middleware for modules migrated off Joi.
 * Accepts either a Zod object schema for { body, query, params } or a parts map.
 */
export const validateZod = (schema) => (req, _res, next) => {
  try {
    if (typeof schema?.safeParse === "function") {
      const parsed = schema.parse({
        body: req.body,
        query: req.query,
        params: req.params
      });
      if (parsed.body !== undefined) mutate(req.body, parsed.body);
      if (parsed.query !== undefined) mutate(req.query, parsed.query);
      if (parsed.params !== undefined) mutate(req.params, parsed.params);
      return next();
    }

    if (schema.body) mutate(req.body, schema.body.parse(req.body));
    if (schema.query) mutate(req.query, schema.query.parse(req.query));
    if (schema.params) mutate(req.params, schema.params.parse(req.params));
    return next();
  } catch (err) {
    if (err instanceof ZodError) {
      return next(
        badRequest(
          "One or more fields are invalid.",
          err.issues.map((issue) => ({
            field: issue.path.join(".") || "request",
            message: issue.message
          }))
        )
      );
    }
    return next(err);
  }
};
