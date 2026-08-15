export interface PriceSnapshot {
  currentPriceCents: number;
  previousPriceCents: number | null;
  currency: string;
  availability: string;
  capturedAt: string;
}

export interface ProductRef {
  productId: string;
  sourceId: string;
  externalId: string;
  canonicalUrl: string;
}

export function calculateDiscountPercent(
  currentCents: number,
  previousCents: number | null,
): number {
  if (!previousCents || previousCents <= 0 || currentCents <= 0) {
    return 0;
  }
  if (previousCents <= currentCents) {
    return 0;
  }
  const discount = ((previousCents - currentCents) / previousCents) * 100;
  return Math.round(discount * 100) / 100;
}

export function validatePrice(
  currentCents: number,
  previousCents: number | null,
  minCents: number,
  maxCents: number,
): { valid: boolean; reason?: string } {
  if (currentCents <= 0) {
    return { valid: false, reason: "PRICE_ZERO_OR_NEGATIVE" };
  }
  if (currentCents < minCents) {
    return { valid: false, reason: "PRICE_BELOW_MINIMUM" };
  }
  if (currentCents > maxCents) {
    return { valid: false, reason: "PRICE_ABOVE_MAXIMUM" };
  }
  if (previousCents !== null && previousCents > 0 && previousCents <= currentCents) {
    return { valid: false, reason: "PREVIOUS_PRICE_NOT_GREATER" };
  }
  return { valid: true };
}

export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function parseBRLPrice(text: string): number | null {
  if (!text) return null;
  const cleaned = text
    .replace(/\s/g, "")
    .replace(/^R\$/i, "")
    .replace(/\./g, "")
    .replace(/,/g, ".");
  const parsed = parseFloat(cleaned);
  if (isNaN(parsed) || parsed <= 0) return null;
  return Math.round(parsed * 100);
}
