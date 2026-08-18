export type ErrorCode =
  | "SOURCE_CAPTCHA_REQUIRED"
  | "SOURCE_SESSION_EXPIRED"
  | "SOURCE_BLOCKED"
  | "SOURCE_RATE_LIMITED"
  | "SOURCE_SELECTOR_NOT_FOUND"
  | "SOURCE_UNAVAILABLE"
  | "SOURCE_AUTH_REQUIRED"
  | "SOURCE_CIRCUIT_OPEN"
  | "VALIDATION_FAILED"
  | "AFFILIATE_LINK_FAILED"
  | "PUBLICATION_FAILED"
  | "DUPLICATE_OFFER"
  | "OFFER_EXPIRED"
  | "OFFER_NOT_FOUND"
  | "INVALID_STATE"
  | "UNAUTHORIZED"
  | "INTERNAL_ERROR";

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly retryable: boolean = false,
    public readonly statusCode: number = 500,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        retryable: this.retryable,
        details: this.details ?? {},
      },
    };
  }
}
