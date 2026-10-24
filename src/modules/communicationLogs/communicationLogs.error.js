import { AppError, createErrorHelpers } from "../error/index.js";

export { AppError };

export class CommunicationLogsError extends AppError {
  constructor(statusCode, code, message, details) {
    super(statusCode, code, message, details);
    this.name = "CommunicationLogsError";
  }
}

export const { badRequest, unauthorized, forbidden, notFound, conflict, domainError } = createErrorHelpers(CommunicationLogsError);
