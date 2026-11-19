import { AppError, createErrorHelpers } from "../error/index.js";

export { AppError };

export class BoostOrdersError extends AppError {
  constructor(statusCode, code, message, details) {
    super(statusCode, code, message, details);
    this.name = "BoostOrdersError";
  }
}

export const { badRequest, unauthorized, forbidden, notFound, conflict, domainError } = createErrorHelpers(BoostOrdersError);
