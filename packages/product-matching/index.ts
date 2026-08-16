import type { NormalizedOffer, MatchConfidence } from "../../apps/worker/src/domain/offer.js";
import { compareTwoStrings } from "string-similarity";

function normalizeIdentifier(id?: string | null): string | null {
  if (!id) return null;
  return id.replace(/[^0-9a-zA-Z]/g, "").toLowerCase();
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^0-9a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function compareOffers(
  left: NormalizedOffer,
  right: NormalizedOffer,
): MatchConfidence {
  const leftIds = left.identifiers;
  const rightIds = right.identifiers;

  if (
    leftIds.gtin &&
    rightIds.gtin &&
    normalizeIdentifier(leftIds.gtin) === normalizeIdentifier(rightIds.gtin)
  ) {
    return { score: 0.99, method: "gtin", status: "matched" };
  }

  if (
    leftIds.ean &&
    rightIds.ean &&
    normalizeIdentifier(leftIds.ean) === normalizeIdentifier(rightIds.ean)
  ) {
    return { score: 0.99, method: "gtin", status: "matched" };
  }

  if (
    left.brand &&
    right.brand &&
    left.identifiers.mpn &&
    right.identifiers.mpn &&
    normalizeIdentifier(left.brand) === normalizeIdentifier(right.brand) &&
    normalizeIdentifier(left.identifiers.mpn) ===
      normalizeIdentifier(right.identifiers.mpn)
  ) {
    return { score: 0.96, method: "brand_mpn", status: "matched" };
  }

  if (
    leftIds.asin &&
    rightIds.asin &&
    normalizeIdentifier(leftIds.asin) === normalizeIdentifier(rightIds.asin)
  ) {
    return { score: 0.95, method: "asin", status: "matched" };
  }

  const titleScore = compareTwoStrings(
    normalizeTitle(left.title),
    normalizeTitle(right.title),
  );

  const identifierScore =
    leftIds.gtin && rightIds.gtin && normalizeIdentifier(leftIds.gtin) === normalizeIdentifier(rightIds.gtin)
      ? 1
      : left.brand &&
          right.brand &&
          left.identifiers.mpn &&
          right.identifiers.mpn &&
          normalizeIdentifier(left.brand) === normalizeIdentifier(right.brand) &&
          normalizeIdentifier(left.identifiers.mpn) ===
            normalizeIdentifier(right.identifiers.mpn)
        ? 0.96
        : leftIds.asin &&
            rightIds.asin &&
            normalizeIdentifier(leftIds.asin) === normalizeIdentifier(rightIds.asin)
          ? 0.95
          : 0;

  const score =
    0.4 * identifierScore +
    0.2 *
      (normalizeIdentifier(left.brand) === normalizeIdentifier(right.brand)
        ? 1
        : 0) +
    0.1 * titleScore;

  if (score >= 0.92) {
    return { score, method: "title_similarity", status: "matched" };
  }
  if (score >= 0.75) {
    return { score, method: "title_similarity", status: "review" };
  }
  return { score, method: "title_similarity", status: "different" };
}
