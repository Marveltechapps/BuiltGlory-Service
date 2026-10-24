import { AppError, createErrorHelpers } from "../error/index.js";

export { AppError };

export class ReportsError extends AppError {
  constructor(statusCode, code, message, details) {
    super(statusCode, code, message, details);
    this.name = "ReportsError";
  }
}

export const { badRequest, unauthorized, forbidden, notFound, conflict, domainError } = createErrorHelpers(ReportsError);
