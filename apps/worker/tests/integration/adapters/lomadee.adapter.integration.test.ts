import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  beforeEach,
  afterAll,
} from "vitest";
import { LomadeeAdapter } from "../../../src/adapters/sources/lomadee.adapter.js";
import { AppError } from "../../../src/shared/errors.js";

// Mock fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("LomadeeAdapter - Integration", () => {
  const apiProduct = {
    data: [
      {
        id: "12345",
        organizationId: "org-1",
        name: "Smartphone Teste 256GB Preto",
        url: "https://example.com/p/12345",
        available: true,
        images: [{ url: "https://example.com/image.jpg" }],
        options: [
          {
            id: "sku-1",
            name: "Smartphone Teste 256GB Preto",
            available: true,
            seller: "Loja Teste",
            pricing: [{ price: 1999.9, listPrice: 2499.9 }],
            stocks: [{ value: 5 }],
          },
        ],
      },
    ],
  };

  beforeAll(() => {
    process.env.LOMADEE_API_KEY = "test-key";
    process.env.LOMADEE_CHANNEL_ID = "test-channel";
    process.env.HTTP_RETRY_MAX = "1";
  });

  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("discovers products from API", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(apiProduct),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });

    const adapter = new LomadeeAdapter();
    const products = await adapter.discover({ limit: 1 });

    expect(products).toHaveLength(1);
    expect(products[0].externalId).toBe("12345");
    expect(products[0].title).toBe("Smartphone Teste 256GB Preto");
    expect(products[0].canonicalUrl).toBe("https://example.com/p/12345");
  });

  it("extracts product data from API", async () => {
    const adapter = new LomadeeAdapter();
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(apiProduct),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });
    await adapter.discover({ limit: 1 });
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
    const adapter = new LomadeeAdapter();
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(apiProduct),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });
    await adapter.discover({ limit: 1 });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve([
          {
            id: "test-channel",
            shortUrls: ["https://short.lomadee.com/123"],
          },
        ]),
    });
    const url = new URL("https://example.com/p/12345");
    const result = await adapter.createAffiliateLink(url);

    expect(result.status).toBe("generated");
    if (result.status === "generated") {
      expect(result.url).toBe("https://short.lomadee.com/123");
    }
  });
});
