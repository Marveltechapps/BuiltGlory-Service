import { AppError, createErrorHelpers } from "../error/index.js";

export { AppError };

export class SigninError extends AppError {
  constructor(statusCode, code, message, details) {
    super(statusCode, code, message, details);
    this.name = "SigninError";
  }
}

export const { badRequest, unauthorized, forbidden, notFound, conflict, domainError } = createErrorHelpers(SigninError);
