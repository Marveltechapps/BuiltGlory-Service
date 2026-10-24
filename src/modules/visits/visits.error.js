import { AppError, createErrorHelpers } from "../error/index.js";

export { AppError };

export class VisitsError extends AppError {
  constructor(statusCode, code, message, details) {
    super(statusCode, code, message, details);
    this.name = "VisitsError";
  }
}

export const { badRequest, unauthorized, forbidden, notFound, conflict, domainError } = createErrorHelpers(VisitsError);
