import { AppError, createErrorHelpers } from "../error/index.js";

export { AppError };

export class UsersError extends AppError {
  constructor(statusCode, code, message, details) {
    super(statusCode, code, message, details);
    this.name = "UsersError";
  }
}

export const { badRequest, unauthorized, forbidden, notFound, conflict, domainError } = createErrorHelpers(UsersError);
