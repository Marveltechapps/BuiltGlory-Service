import { AppError, createErrorHelpers } from "../error/index.js";

export { AppError };

export class AuditLogsError extends AppError {
  constructor(statusCode, code, message, details) {
    super(statusCode, code, message, details);
    this.name = "AuditLogsError";
  }
}

export const { badRequest, unauthorized, forbidden, notFound, conflict, domainError } = createErrorHelpers(AuditLogsError);
