import { AppError, createErrorHelpers } from "../error/index.js";

export { AppError };

export class AppFeedbackError extends AppError {
  constructor(statusCode, code, message, details) {
    super(statusCode, code, message, details);
    this.name = "AppFeedbackError";
  }
}

export const { badRequest, unauthorized, forbidden, notFound, conflict, domainError } = createErrorHelpers(AppFeedbackError);
