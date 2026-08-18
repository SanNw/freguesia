import { describe, it, expect, vi } from "vitest";

vi.mock("../../src/config/env.js", () => ({
  env: {
    MIN_PRICE_CENTS: 100,
    MAX_PRICE_CENTS: 5000000,
    DEFAULT_CURRENCY: "BRL",
    MIN_DISCOUNT_PERCENT: 20,
    MAX_AUTOMATIC_DISCOUNT_PERCENT: 80,
  },
}));

const { validateOffer } =
  await import("../../src/application/validate-offer.js");

describe("validateOffer", () => {
  it("requires an image for an otherwise valid promotion", () => {
    const result = validateOffer({
      source: "manual",
      externalId: "image-required",
      canonicalUrl: "https://example.com/product",
      title: "Produto com desconto",
      currentPriceCents: 4990,
      previousPriceCents: 7990,
      currency: "BRL",
      availability: "in_stock",
      imageUrl: null,
      seller: null,
      rating: null,
      reviewCount: null,
      capturedAt: new Date().toISOString(),
      rawEvidence: {},
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("IMAGE_REQUIRED");
  });

  it("accepts a valid offer with discount", () => {
    const result = validateOffer({
      source: "manual",
      externalId: "abc123",
      canonicalUrl: "https://example.com/product",
      title: "Livro Teste",
      currentPriceCents: 4990,
      previousPriceCents: 7990,
      currency: "BRL",
      availability: "in_stock",
      imageUrl: "https://example.com/image.jpg",
      seller: null,
      rating: 4.5,
      reviewCount: 100,
      capturedAt: new Date().toISOString(),
      rawEvidence: {},
    });
    expect(result.valid).toBe(true);
    expect(result.score).toBeGreaterThan(0);
    expect(result.discountPercent).toBe(37.55);
  });

  it("rejects zero or negative price", () => {
    const result = validateOffer({
      source: "manual",
      externalId: "abc123",
      canonicalUrl: "https://example.com/product",
      title: "Produto",
      currentPriceCents: 0,
      previousPriceCents: 7990,
      currency: "BRL",
      availability: "in_stock",
      seller: null,
      rating: null,
      reviewCount: null,
      capturedAt: new Date().toISOString(),
      rawEvidence: {},
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("PRICE_ZERO_OR_NEGATIVE");
  });

  it("rejects below minimum price", () => {
    const result = validateOffer({
      source: "manual",
      externalId: "abc123",
      canonicalUrl: "https://example.com/product",
      title: "Produto",
      currentPriceCents: 50,
      previousPriceCents: 100,
      currency: "BRL",
      availability: "in_stock",
      seller: null,
      rating: null,
      reviewCount: null,
      capturedAt: new Date().toISOString(),
      rawEvidence: {},
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("PRICE_BELOW_MINIMUM");
  });

  it("rejects wrong currency", () => {
    const result = validateOffer({
      source: "manual",
      externalId: "abc123",
      canonicalUrl: "https://example.com/product",
      title: "Produto",
      currentPriceCents: 4990,
      previousPriceCents: 7990,
      currency: "USD",
      availability: "in_stock",
      seller: null,
      rating: null,
      reviewCount: null,
      capturedAt: new Date().toISOString(),
      rawEvidence: {},
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("WRONG_CURRENCY");
  });

  it("rejects previous price <= current price", () => {
    const result = validateOffer({
      source: "manual",
      externalId: "abc123",
      canonicalUrl: "https://example.com/product",
      title: "Produto",
      currentPriceCents: 5000,
      previousPriceCents: 4000,
      currency: "BRL",
      availability: "in_stock",
      seller: null,
      rating: null,
      reviewCount: null,
      capturedAt: new Date().toISOString(),
      rawEvidence: {},
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("PREVIOUS_PRICE_NOT_GREATER");
  });

  it("rejects discount below minimum (20%)", () => {
    const result = validateOffer({
      source: "manual",
      externalId: "abc123",
      canonicalUrl: "https://example.com/product",
      title: "Produto",
      currentPriceCents: 9500,
      previousPriceCents: 10000,
      currency: "BRL",
      availability: "in_stock",
      seller: null,
      rating: null,
      reviewCount: null,
      capturedAt: new Date().toISOString(),
      rawEvidence: {},
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("DISCOUNT_BELOW_MINIMUM");
  });

  it("rejects discount above 80% for manual review", () => {
    const result = validateOffer({
      source: "manual",
      externalId: "abc123",
      canonicalUrl: "https://example.com/product",
      title: "Produto",
      currentPriceCents: 1000,
      previousPriceCents: 10000,
      currency: "BRL",
      availability: "in_stock",
      seller: null,
      rating: null,
      reviewCount: null,
      capturedAt: new Date().toISOString(),
      rawEvidence: {},
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("DISCOUNT_TOO_HIGH_REVIEW");
  });

  it("returns score even when discount is below minimum (no previous price)", () => {
    const result = validateOffer({
      source: "manual",
      externalId: "abc123",
      canonicalUrl: "https://example.com/product",
      title: "Produto Teste",
      currentPriceCents: 4990,
      previousPriceCents: null,
      currency: "BRL",
      availability: "in_stock",
      imageUrl: "https://example.com/image.jpg",
      seller: null,
      rating: 4,
      reviewCount: 50,
      capturedAt: new Date().toISOString(),
      rawEvidence: {},
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("DISCOUNT_BELOW_MINIMUM");
  });

  it("applies penalty for short title", () => {
    const result = validateOffer({
      source: "manual",
      externalId: "abc123",
      canonicalUrl: "https://example.com/product",
      title: "ABC",
      currentPriceCents: 4990,
      previousPriceCents: 7990,
      currency: "BRL",
      availability: "in_stock",
      imageUrl: "https://example.com/image.jpg",
      seller: null,
      rating: null,
      reviewCount: null,
      capturedAt: new Date().toISOString(),
      rawEvidence: {},
    });
    expect(result.valid).toBe(true);
    expect(result.score).toBeDefined();
    expect(result.score).toBeLessThan(50);
  });
});
