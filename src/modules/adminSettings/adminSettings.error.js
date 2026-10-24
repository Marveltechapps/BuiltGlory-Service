import { AppError, createErrorHelpers } from "../error/index.js";

export { AppError };

export class AdminSettingsError extends AppError {
  constructor(statusCode, code, message, details) {
    super(statusCode, code, message, details);
    this.name = "AdminSettingsError";
  }
}

export const { badRequest, unauthorized, forbidden, notFound, conflict, domainError } = createErrorHelpers(AdminSettingsError);
