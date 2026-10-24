import { AppError, createErrorHelpers } from "../error/index.js";

export { AppError };

export class ChatThreadsError extends AppError {
  constructor(statusCode, code, message, details) {
    super(statusCode, code, message, details);
    this.name = "ChatThreadsError";
  }
}

export const { badRequest, unauthorized, forbidden, notFound, conflict, domainError } = createErrorHelpers(ChatThreadsError);
