import type { ExtractedProduct } from "../domain/offer.js";
import { calculateDiscountPercent, validatePrice } from "../domain/price.js";
import { env } from "../config/env.js";

export function validateOffer(extracted: ExtractedProduct): {
  valid: boolean;
  score?: number;
  discountPercent?: number;
  reason?: string;
} {
  const priceCheck = validatePrice(
    extracted.currentPriceCents,
    extracted.previousPriceCents ?? null,
    env.MIN_PRICE_CENTS,
    env.MAX_PRICE_CENTS,
  );
  if (!priceCheck.valid) {
    return { valid: false, reason: priceCheck.reason };
  }

  if (extracted.currency !== env.DEFAULT_CURRENCY) {
    return { valid: false, reason: "WRONG_CURRENCY" };
  }

  const discount = calculateDiscountPercent(
    extracted.currentPriceCents,
    extracted.previousPriceCents ?? null,
  );

  if (discount < env.MIN_DISCOUNT_PERCENT && env.MIN_DISCOUNT_PERCENT > 0) {
    return { valid: false, reason: "DISCOUNT_BELOW_MINIMUM" };
  }

  if (
    discount > env.MAX_AUTOMATIC_DISCOUNT_PERCENT &&
    env.MAX_AUTOMATIC_DISCOUNT_PERCENT < 100
  ) {
    return { valid: false, reason: "DISCOUNT_TOO_HIGH_REVIEW" };
  }

  if (!extracted.imageUrl) {
    return { valid: false, reason: "IMAGE_REQUIRED" };
  }

  let score = 0;
  score += Math.min(discount, 35);
  score += extracted.availability === "in_stock" ? 10 : 0;
  score += extracted.imageUrl ? 5 : 0;
  score += extracted.rating ? Math.min(extracted.rating * 2, 5) : 0;
  score += extracted.reviewCount ? Math.min(extracted.reviewCount / 100, 5) : 0;
  if (!extracted.previousPriceCents) score -= 25;
  if (!extracted.title || extracted.title.length < 5) score -= 10;
  if (!extracted.imageUrl) score -= 10;

  return {
    valid: true,
    score: Math.max(0, Math.round(score)),
    discountPercent: discount,
  };
}
