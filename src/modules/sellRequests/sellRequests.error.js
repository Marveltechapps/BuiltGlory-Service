import { AppError, createErrorHelpers } from "../error/index.js";

export { AppError };

export class SellRequestsError extends AppError {
  constructor(statusCode, code, message, details) {
    super(statusCode, code, message, details);
    this.name = "SellRequestsError";
  }
}

export const { badRequest, unauthorized, forbidden, notFound, conflict, domainError } = createErrorHelpers(SellRequestsError);
