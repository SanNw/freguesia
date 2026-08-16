import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { AwinAdapter } from "../../../src/adapters/sources/awin.adapter.js";
import { AppError } from "../../../src/shared/errors.js";
import awinPromotion from "../../fixtures/awin-promotion.json";

// Mock fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("AwinAdapter - Integration", () => {
  beforeAll(() => {
    process.env.AWIN_API_TOKEN = "test-token";
    process.env.AWIN_PUBLISHER_ID = "test-publisher";
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("discovers promotions from API", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(awinPromotion),
    });

    const adapter = new AwinAdapter();
    const products = await adapter.discover({ limit: 1 });

    expect(products).toHaveLength(1);
    expect(products[0].externalId).toBe("promo123");
    expect(products[0].title).toBe("Awin Smartphone Teste 512GB");
    expect(products[0].canonicalUrl).toBe("https://awin.example.com/p/promo123");
  });

  it("extracts promotion data from API", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(awinPromotion[0]),
    });

    const adapter = new AwinAdapter();
    const url = new URL("https://awin.example.com/p/promo123");
    const extracted = await adapter.extract({ url });

    expect(extracted.externalId).toBe("promo123");
    expect(extracted.title).toBe("Awin Smartphone Teste 512GB");
    expect(extracted.currentPriceCents).toBe(299900);
    expect(extracted.previousPriceCents).toBe(349900);
    expect(extracted.imageUrl).toBe("https://awin.example.com/image.jpg");
    expect(extracted.seller).toBe("Loja Awin");
  });

  it("handles rate limit", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 429,
      headers: new Map([["Retry-After", "60"]]),
    });

    const adapter = new AwinAdapter();
    await expect(adapter.discover({})).rejects.toThrow(AppError);
    await expect(adapter.discover({})).rejects.toThrow("Rate limited");
  });

  it("creates affiliate link", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ generatedLink: "https://awin.tracker.com/123" }),
    });

    const adapter = new AwinAdapter();
    const url = new URL("https://store.example.com/product/xyz");
    const result = await adapter.createAffiliateLink(url);

    expect(result.status).toBe("generated");
    if (result.status === "generated") {
      expect(result.url).toBe("https://awin.tracker.com/123");
    }
  });
});
