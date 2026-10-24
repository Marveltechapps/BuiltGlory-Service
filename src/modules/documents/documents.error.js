import { AppError, createErrorHelpers } from "../error/index.js";

export { AppError };

export class DocumentsError extends AppError {
  constructor(statusCode, code, message, details) {
    super(statusCode, code, message, details);
    this.name = "DocumentsError";
  }
}

export const { badRequest, unauthorized, forbidden, notFound, conflict, domainError } = createErrorHelpers(DocumentsError);
