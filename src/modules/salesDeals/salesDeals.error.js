import { AppError, createErrorHelpers } from "../error/index.js";

export { AppError };

export class SalesDealsError extends AppError {
  constructor(statusCode, code, message, details) {
    super(statusCode, code, message, details);
    this.name = "SalesDealsError";
  }
}

export const { badRequest, unauthorized, forbidden, notFound, conflict, domainError } = createErrorHelpers(SalesDealsError);
