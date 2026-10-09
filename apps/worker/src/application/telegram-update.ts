import { AppError } from "../shared/errors.js";

export function shouldRetryTelegramUpdate(error: unknown): boolean {
  return !(error instanceof AppError) || error.retryable;
}

export function parseEditCommand(text: string): {
  offerId: string;
  caption: string;
} | null {
  const match = text.match(
    /^\/editar\s+([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\s*\n([\s\S]+)$/i,
  );
  if (!match) return null;
  const caption = match[2].trim();
  return caption ? { offerId: match[1], caption } : null;
}
