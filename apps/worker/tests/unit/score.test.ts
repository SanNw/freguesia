import { describe, it, expect } from "vitest";
import { scoreOffer } from "../../src/application/score.js";

describe("scoreOffer", () => {
  it("scores a good offer positively", () => {
    const score = scoreOffer({
      discountPercent: 38,
      currentPriceCents: 4990,
      previousPriceCents: 7990,
      sourceReliability: 12,
      availability: "in_stock",
      rating: 4.5,
      reviewCount: 200,
      nicheMatch: 8,
      hasPreviousPriceEvidence: true,
      titleComplete: true,
      hasImage: true,
      isExperimental: false,
    });
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("penalizes missing previous price evidence", () => {
    const score = scoreOffer({
      discountPercent: 30,
      currentPriceCents: 4990,
      previousPriceCents: null,
      sourceReliability: 15,
      availability: "in_stock",
      rating: 5,
      reviewCount: 500,
      nicheMatch: 10,
      hasPreviousPriceEvidence: false,
      titleComplete: true,
      hasImage: true,
      isExperimental: false,
    });
    expect(score).toBeLessThan(80);
  });

  it("penalizes experimental source", () => {
    const score = scoreOffer({
      discountPercent: 40,
      currentPriceCents: 4990,
      previousPriceCents: 7990,
      sourceReliability: 5,
      availability: "in_stock",
      rating: 4,
      reviewCount: 100,
      nicheMatch: 8,
      hasPreviousPriceEvidence: true,
      titleComplete: true,
      hasImage: true,
      isExperimental: true,
    });
    expect(score).toBeLessThan(80);
  });

  it("does not go below 0", () => {
    const score = scoreOffer({
      discountPercent: 0,
      currentPriceCents: 4990,
      previousPriceCents: null,
      sourceReliability: 0,
      availability: "unknown",
      rating: null,
      reviewCount: null,
      nicheMatch: 0,
      hasPreviousPriceEvidence: false,
      titleComplete: false,
      hasImage: false,
      isExperimental: true,
    });
    expect(score).toBe(0);
  });
});
