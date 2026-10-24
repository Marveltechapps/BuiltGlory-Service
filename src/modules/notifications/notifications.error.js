import { AppError, createErrorHelpers } from "../error/index.js";

export { AppError };

export class NotificationsError extends AppError {
  constructor(statusCode, code, message, details) {
    super(statusCode, code, message, details);
    this.name = "NotificationsError";
  }
}

export const { badRequest, unauthorized, forbidden, notFound, conflict, domainError } = createErrorHelpers(NotificationsError);
