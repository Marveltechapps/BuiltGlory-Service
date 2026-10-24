import { AppError, createErrorHelpers } from "../error/index.js";

export { AppError };

export class PropertiesError extends AppError {
  constructor(statusCode, code, message, details) {
    super(statusCode, code, message, details);
    this.name = "PropertiesError";
  }
}

export const { badRequest, unauthorized, forbidden, notFound, conflict, domainError } = createErrorHelpers(PropertiesError);
