import { AppError, createErrorHelpers } from "../error/index.js";

export { AppError };

export class BuyEnquiriesError extends AppError {
  constructor(statusCode, code, message, details) {
    super(statusCode, code, message, details);
    this.name = "BuyEnquiriesError";
  }
}

export const { badRequest, unauthorized, forbidden, notFound, conflict, domainError } = createErrorHelpers(BuyEnquiriesError);
