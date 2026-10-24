import { AppError, createErrorHelpers } from "../error/index.js";

export { AppError };

export class ContentError extends AppError {
  constructor(statusCode, code, message, details) {
    super(statusCode, code, message, details);
    this.name = "ContentError";
  }
}

export const { badRequest, unauthorized, forbidden, notFound, conflict, domainError } = createErrorHelpers(ContentError);
