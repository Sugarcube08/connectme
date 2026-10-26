export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found", code = "NOT_FOUND") {
    super(code, message, 404);
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation failed", details?: unknown) {
    super("VALIDATION_ERROR", message, 400, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required", code = "UNAUTHORIZED") {
    super(code, message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Access forbidden", code = "FORBIDDEN") {
    super(code, message, 403);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflict occurred", code = "CONFLICT") {
    super(code, message, 409);
  }
}

export class OtpError extends AppError {
  constructor(message = "Invalid or expired verification code", code = "INVALID_OTP") {
    super(code, message, 400);
  }
}

export class GoneError extends AppError {
  constructor(message = "Resource expired or revoked", code = "RESOURCE_GONE") {
    super(code, message, 410);
  }
}
