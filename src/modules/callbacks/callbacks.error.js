import { AppError, createErrorHelpers } from "../error/index.js";

export { AppError };

export class CallbacksError extends AppError {
  constructor(statusCode, code, message, details) {
    super(statusCode, code, message, details);
    this.name = "CallbacksError";
  }
}

export const { badRequest, unauthorized, forbidden, notFound, conflict, domainError } = createErrorHelpers(CallbacksError);
