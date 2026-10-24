import { AppError, createErrorHelpers } from "../error/index.js";

export { AppError };

export class InteriorLeadsError extends AppError {
  constructor(statusCode, code, message, details) {
    super(statusCode, code, message, details);
    this.name = "InteriorLeadsError";
  }
}

export const { badRequest, unauthorized, forbidden, notFound, conflict, domainError } = createErrorHelpers(InteriorLeadsError);
