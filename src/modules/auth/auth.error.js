import { AppError, createErrorHelpers } from "../error/index.js";

export { AppError };

export class AuthError extends AppError {
  constructor(statusCode, code, message, details) {
    super(statusCode, code, message, details);
    this.name = "AuthError";
  }
}

export const { badRequest, unauthorized, forbidden, notFound, conflict, domainError } = createErrorHelpers(AuthError);
