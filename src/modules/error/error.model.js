export class AppError extends Error {
  constructor(statusCode, code, message, details = []) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
  }
}
export const badRequest = (message, details) => new AppError(400, "VALIDATION_ERROR", message, details);
export const unauthorized = (message = "Authentication required.") => new AppError(401, "UNAUTHORIZED", message);
export const forbidden = (message = "Permission denied.") => new AppError(403, "FORBIDDEN", message);
export const notFound = (message = "Resource not found.") => new AppError(404, "NOT_FOUND", message);
export const conflict = (message = "Conflict.", details = []) => new AppError(409, "CONFLICT", message, details);
export const domainError = (message, details) => new AppError(422, "DOMAIN_RULE_VIOLATION", message, details);
export const serviceUnavailable = (message = "Redis is unavailable.") => new AppError(503, "SERVICE_UNAVAILABLE", message);
export const createErrorHelpers = (ErrorClass) => ({
  badRequest: (message, details) => new ErrorClass(400, "VALIDATION_ERROR", message, details),
  unauthorized: (message = "Authentication required.") => new ErrorClass(401, "UNAUTHORIZED", message),
  forbidden: (message = "Permission denied.") => new ErrorClass(403, "FORBIDDEN", message),
  notFound: (message = "Resource not found.") => new ErrorClass(404, "NOT_FOUND", message),
  conflict: (message = "Conflict.", details = []) => new ErrorClass(409, "CONFLICT", message, details),
  domainError: (message, details) => new ErrorClass(422, "DOMAIN_RULE_VIOLATION", message, details),
  serviceUnavailable: (message = "Redis is unavailable.") => new ErrorClass(503, "SERVICE_UNAVAILABLE", message)
});
