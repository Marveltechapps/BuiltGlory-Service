import { AppError, createErrorHelpers } from "../error/index.js";

export { AppError };

export class ConversationMessagesError extends AppError {
  constructor(statusCode, code, message, details) {
    super(statusCode, code, message, details);
    this.name = "ConversationMessagesError";
  }
}

export const { badRequest, unauthorized, forbidden, notFound, conflict, domainError } = createErrorHelpers(ConversationMessagesError);
