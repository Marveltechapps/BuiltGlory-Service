import { AppError, createErrorHelpers } from "../error/index.js";

export { AppError };

export class AppConfigError extends AppError {
  constructor(statusCode, code, message, details) {
    super(statusCode, code, message, details);
    this.name = "AppConfigError";
  }
}

export const { badRequest, unauthorized, forbidden, notFound, conflict, domainError } = createErrorHelpers(AppConfigError);
