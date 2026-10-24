import { AppError, createErrorHelpers } from "../error/index.js";

export { AppError };

export class SupportTicketsError extends AppError {
  constructor(statusCode, code, message, details) {
    super(statusCode, code, message, details);
    this.name = "SupportTicketsError";
  }
}

export const { badRequest, unauthorized, forbidden, notFound, conflict, domainError } = createErrorHelpers(SupportTicketsError);
