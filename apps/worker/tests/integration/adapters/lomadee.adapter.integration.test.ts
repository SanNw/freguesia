import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { LomadeeAdapter } from "../../../src/adapters/sources/lomadee.adapter.js";
import { AppError } from "../../../src/shared/errors.js";
import lomadeeProduct from "../../fixtures/lomadee-product.json";

// Mock fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("LomadeeAdapter - Integration", () => {
  beforeAll(() => {
    process.env.LOMADEE_API_KEY = "test-key";
    process.env.LOMADEE_CHANNEL_ID = "test-channel";
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("discovers products from API", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(lomadeeProduct),
    });

    const adapter = new LomadeeAdapter();
    const products = await adapter.discover({ limit: 1 });

    expect(products).toHaveLength(1);
    expect(products[0].externalId).toBe("12345");
    expect(products[0].title).toBe("Smartphone Teste 256GB Preto");
    expect(products[0].canonicalUrl).toBe("https://example.com/p/12345");
  });

  it("extracts product data from API", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(lomadeeProduct.products[0]),
    });

    const adapter = new LomadeeAdapter();
    const url = new URL("https://example.com/p/12345");
    const extracted = await adapter.extract({ url });

    expect(extracted.externalId).toBe("12345");
    expect(extracted.title).toBe("Smartphone Teste 256GB Preto");
    expect(extracted.currentPriceCents).toBe(199990);
    expect(extracted.previousPriceCents).toBe(249990);
    expect(extracted.imageUrl).toBe("https://example.com/image.jpg");
    expect(extracted.availability).toBe("in_stock");
  });

  it("handles rate limit", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 429,
      headers: new Map([["Retry-After", "60"]]),
    });

    const adapter = new LomadeeAdapter();
    await expect(adapter.discover({})).rejects.toThrow(AppError);
    await expect(adapter.discover({})).rejects.toThrow("Rate limited");
  });

  it("handles API errors", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    const adapter = new LomadeeAdapter();
    await expect(adapter.discover({})).rejects.toThrow(AppError);
    await expect(adapter.discover({})).rejects.toThrow("Lomadee API error");
  });

  it("creates affiliate link", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ link: "https://short.lomadee.com/123" }),
    });

    const adapter = new LomadeeAdapter();
    const url = new URL("https://example.com/p/12345");
    const result = await adapter.createAffiliateLink(url);

    expect(result.status).toBe("generated");
    if (result.status === "generated") {
      expect(result.url).toBe("https://short.lomadee.com/123");
    }
  });
});
