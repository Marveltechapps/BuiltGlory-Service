import type { NextFunction, Request, Response } from "express";
import type { ZodTypeAny } from "zod";
import { ZodError } from "zod";
import { badRequest } from "../modules/error/index.js";

type RequestParts = {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
};

const mutate = (target: Record<string, unknown>, source: unknown) => {
  if (!source || typeof source !== "object" || target === source) return;
  for (const key of Object.keys(target)) delete target[key];
  Object.assign(target, source);
};

/**
 * Zod validation middleware (replaces Joi validate() for migrated modules).
 * Pass either a single Zod object with { body, query, params } or a parts map.
 */
export const validateZod = (schema: ZodTypeAny | RequestParts) => (req: Request, _res: Response, next: NextFunction) => {
  try {
    if ("safeParse" in (schema as ZodTypeAny)) {
      const parsed = (schema as ZodTypeAny).parse({
        body: req.body,
        query: req.query,
        params: req.params
      }) as { body?: unknown; query?: unknown; params?: unknown };
      if (parsed.body !== undefined) mutate(req.body as Record<string, unknown>, parsed.body);
      if (parsed.query !== undefined) mutate(req.query as Record<string, unknown>, parsed.query);
      if (parsed.params !== undefined) mutate(req.params as Record<string, unknown>, parsed.params);
      return next();
    }

    const parts = schema as RequestParts;
    if (parts.body) mutate(req.body as Record<string, unknown>, parts.body.parse(req.body));
    if (parts.query) mutate(req.query as Record<string, unknown>, parts.query.parse(req.query));
    if (parts.params) mutate(req.params as Record<string, unknown>, parts.params.parse(req.params));
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
