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
    return { score: 0.99, method: "gtin", status: "matched", evidence: {} };
  }

  if (
    leftIds.ean &&
    rightIds.ean &&
    normalizeIdentifier(leftIds.ean) === normalizeIdentifier(rightIds.ean)
  ) {
    return { score: 0.99, method: "gtin", status: "matched", evidence: {} };
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
    return { score: 0.96, method: "brand_mpn", status: "matched", evidence: {} };
  }

  if (
    leftIds.asin &&
    rightIds.asin &&
    normalizeIdentifier(leftIds.asin) === normalizeIdentifier(rightIds.asin)
  ) {
    return { score: 0.95, method: "asin", status: "matched", evidence: {} };
  }

  const titleScore = compareTwoStrings(
    normalizeTitle(left.title),
    normalizeTitle(right.title),
  );

  const score = titleScore;

  if (score >= 0.92) {
    return { score, method: "title_similarity", status: "matched", evidence: {} };
  }
  if (score >= 0.75) {
    return { score, method: "title_similarity", status: "review", evidence: {} };
  }
  return { score, method: "title_similarity", status: "different", evidence: {} };
}
