import { AppError, createErrorHelpers } from "../error/index.js";

export { AppError };

export class AcquisitionsError extends AppError {
  constructor(statusCode, code, message, details) {
    super(statusCode, code, message, details);
    this.name = "AcquisitionsError";
  }
}

export const { badRequest, unauthorized, forbidden, notFound, conflict, domainError } = createErrorHelpers(AcquisitionsError);
