import { createHash } from "node:crypto";

export function generateExternalId(canonicalUrl: string): string {
  return createHash("sha256").update(canonicalUrl).digest("hex").slice(0, 32);
}

export function generateIdempotencyKey(
  source: string,
  externalId: string,
  priceCents: number,
  nowIso: string,
): string {
  const hourBucket = nowIso.slice(0, 13);
  return createHash("sha256")
    .update(`${source}${externalId}${priceCents}${hourBucket}`)
    .digest("hex");
}

export function isUrlValid(url?: string | null): boolean {
  if (!url) return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function isUnchangedPrice(
  lastSeenPriceCents: number | null,
  currentPriceCents: number,
): boolean {
  return lastSeenPriceCents !== null && lastSeenPriceCents === currentPriceCents;
}
