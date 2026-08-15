import { calculateDiscountPercent } from "../domain/price.js";

export interface ScoringInput {
  discountPercent?: number | null;
  currentPriceCents: number;
  previousPriceCents: number | null;
  sourceReliability: number;
  availability: string;
  rating: number | null;
  reviewCount: number | null;
  nicheMatch: number;
  hasPreviousPriceEvidence: boolean;
  titleComplete: boolean;
  hasImage: boolean;
  isExperimental: boolean;
}

export function scoreOffer(input: ScoringInput): number {
  const discount =
    input.discountPercent ??
    calculateDiscountPercent(input.currentPriceCents, input.previousPriceCents);

  let score = 0;
  score += Math.min(discount, 35);
  score += Math.min(input.sourceReliability, 15);
  score += input.availability === "in_stock" ? 10 : 0;
  if (input.rating) score += Math.min(input.rating * 2, 5);
  if (input.reviewCount) score += Math.min(input.reviewCount / 100, 5);
  score += Math.min(input.nicheMatch, 10);

  const penalties: number[] = [];
  if (!input.hasPreviousPriceEvidence) penalties.push(25);
  if (!input.titleComplete) penalties.push(10);
  if (!input.hasImage) penalties.push(10);
  if (input.isExperimental) penalties.push(15);

  const totalPenalty = penalties.reduce((a, b) => a + b, 0);
  return Math.max(0, Math.round(score - totalPenalty));
}
