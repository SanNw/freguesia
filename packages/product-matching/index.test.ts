import { describe, it, expect } from "vitest";
import { compareOffers } from "@freguesia/product-matching";
import type { NormalizedOffer } from "../../apps/worker/src/domain/offer.js";

const baseOffer: NormalizedOffer = {
  schemaVersion: "1.0",
  source: "test",
  sourceOfferId: "1",
  sourceProductId: "1",
  merchantId: "1",
  merchantName: "Test Store",
  title: "Product Title",
  brand: "Brand",
  model: "Model",
  identifiers: { gtin: "1234567890" },
  categoryPath: [],
  condition: "new",
  price: {
    currentCents: 1000,
    currency: "BRL",
    installmentValueCents: null,
  },
  shipping: { confirmed: false, currency: "BRL" },
  tax: { confirmed: false },
  coupon: { autoApplied: false },
  availability: { inStock: true },
  urls: {
    canonical: "https://example.com/product",
    affiliate: "https://example.com/affiliate",
    additionalImages: [],
  },
  seller: { name: "Test Store", officialStore: false },
  validity: {
    fetchedAt: new Date().toISOString(),
    lastVerifiedAt: new Date().toISOString(),
  },
  tracking: { attributionVerified: false, campaign: "test" },
  rawHash: "hash",
};

describe("compareOffers", () => {
  it("matches identical GTINs", () => {
    const offerA = { ...baseOffer };
    const offerB = {
      ...baseOffer,
      identifiers: { gtin: "1234567890" },
    };
    const result = compareOffers(offerA, offerB);
    expect(result.score).toBe(0.99);
    expect(result.method).toBe("gtin");
    expect(result.status).toBe("matched");
  });

  it("matches identical EANs", () => {
    const offerA = {
      ...baseOffer,
      identifiers: { ean: "0987654321" },
    };
    const offerB = {
      ...baseOffer,
      identifiers: { ean: "0987654321" },
    };
    const result = compareOffers(offerA, offerB);
    expect(result.score).toBe(0.99);
    expect(result.method).toBe("gtin");
    expect(result.status).toBe("matched");
  });

  it("matches identical Brand+MPN", () => {
    const offerA = {
      ...baseOffer,
      identifiers: { mpn: "XYZ-123" },
    };
    const offerB = {
      ...baseOffer,
      identifiers: { mpn: "XYZ-123" },
    };
    const result = compareOffers(offerA, offerB);
    expect(result.score).toBe(0.96);
    expect(result.method).toBe("brand_mpn");
    expect(result.status).toBe("matched");
  });

  it("matches identical ASINs", () => {
    const offerA = {
      ...baseOffer,
      identifiers: { asin: "B012345678" },
    };
    const offerB = {
      ...baseOffer,
      identifiers: { asin: "B012345678" },
    };
    const result = compareOffers(offerA, offerB);
    expect(result.score).toBe(0.95);
    expect(result.method).toBe("asin");
    expect(result.status).toBe("matched");
  });

  it("matches highly similar titles", () => {
    const offerA = {
      ...baseOffer,
      title: "Smartphone Marca X Modelo Y 256GB Preto",
      identifiers: {},
    };
    const offerB = {
      ...baseOffer,
      title: "Smartphone Marca X Modelo Y 256GB - Preto",
      identifiers: {},
    };
    const result = compareOffers(offerA, offerB);
    expect(result.score).toBeGreaterThanOrEqual(0.92);
    expect(result.method).toBe("title_similarity");
    expect(result.status).toBe("matched");
  });

  it("sends moderately similar titles to review", () => {
    const offerA = {
      ...baseOffer,
      title: "Smartphone Marca X Modelo Y 256GB",
      identifiers: {},
    };
    const offerB = {
      ...baseOffer,
      title: "Smartphone Marca X Modelo Y 128GB",
      identifiers: {},
    };
    const result = compareOffers(offerA, offerB);
    expect(result.score).toBeGreaterThanOrEqual(0.75);
    expect(result.score).toBeLessThan(0.92);
    expect(result.method).toBe("title_similarity");
    expect(result.status).toBe("review");
  });

  it("marks different titles as different", () => {
    const offerA = {
      ...baseOffer,
      title: "Smartphone Marca A",
      identifiers: {},
    };
    const offerB = {
      ...baseOffer,
      title: "Carregador Marca B",
      identifiers: {},
    };
    const result = compareOffers(offerA, offerB);
    expect(result.score).toBeLessThan(0.75);
    expect(result.method).toBe("title_similarity");
    expect(result.status).toBe("different");
  });

  it("normalizes identifiers for comparison", () => {
    const offerA = {
      ...baseOffer,
      identifiers: { gtin: "123-456-789-0" },
    };
    const offerB = {
      ...baseOffer,
      identifiers: { gtin: "1234567890" },
    };
    const result = compareOffers(offerA, offerB);
    expect(result.score).toBe(0.99);
  });

  it("normalizes titles for comparison", () => {
    const offerA = {
      ...baseOffer,
      title: "Smartphone Ação",
      identifiers: {},
    };
    const offerB = {
      ...baseOffer,
      title: "SMARTPHONE ACAO!",
      identifiers: {},
    };
    const result = compareOffers(offerA, offerB);
    expect(result.score).toBeGreaterThan(0.95);
  });
});
