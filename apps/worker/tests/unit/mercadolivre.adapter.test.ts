import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/adapters/mercadolivre/oauth.js", () => ({
  getMercadoLivreAccessToken: vi.fn().mockResolvedValue("test-token"),
}));

vi.mock("../../src/config/env.js", () => ({
  env: {
    MERCADOLIVRE_API_BASE_URL: "https://api.mercadolibre.com",
    SOURCE_MERCADOLIVRE_ENABLED: true,
  },
}));

import { MercadoLivreAdapter } from "../../src/adapters/sources/mercadolivre.adapter.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("MercadoLivreAdapter", () => {
  beforeEach(() => mockFetch.mockReset());

  it("discovers authenticated marketplace items", async () => {
    mockFetch
      .mockResolvedValueOnce(
        response({
          results: [
            {
              id: "MLB55044657",
              name: "Produto em promoção",
              status: "active",
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        response({
          results: [
            {
              item_id: "MLB1234567890",
              price: 799.9,
              original_price: 999.9,
              currency_id: "BRL",
              condition: "new",
            },
          ],
        }),
      );
    const products = await new MercadoLivreAdapter().discover({
      query: "produto",
      limit: 1,
    });
    expect(products).toEqual([
      {
        externalId: "MLB1234567890",
        title: "Produto em promoção",
        canonicalUrl:
          "https://produto.mercadolivre.com.br/MLB-1234567890?catalog_product_id=MLB55044657",
      },
    ]);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/products/search?site_id=MLB&q=produto"),
      expect.objectContaining({
        headers: { Authorization: "Bearer test-token" },
      }),
    );
  });

  it("uses the official sale price as discount evidence", async () => {
    mockFetch
      .mockResolvedValueOnce(
        response({
          results: [
            {
              id: "MLB55044657",
              name: "Produto em promoção",
              status: "active",
              pictures: [{ url: "http://http2.mlstatic.com/item.jpg" }],
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        response({
          results: [
            {
              item_id: "MLB1234567890",
              seller_id: 10,
              price: 799.9,
              original_price: 999.9,
              currency_id: "BRL",
              condition: "new",
            },
          ],
        }),
      );
    const adapter = new MercadoLivreAdapter();
    const [candidate] = await adapter.discover({ query: "produto", limit: 1 });
    const extracted = await adapter.extract({
      url: new URL(candidate.canonicalUrl),
    });
    expect(extracted.currentPriceCents).toBe(79990);
    expect(extracted.previousPriceCents).toBe(99990);
    expect(extracted.imageUrl).toBe("https://http2.mlstatic.com/item.jpg");
    expect(extracted.rawEvidence.sellerId).toBe(10);
    expect(extracted.availability).toBe("in_stock");
  });

  it("requires manual affiliate-link generation", async () => {
    const result = await new MercadoLivreAdapter().createAffiliateLink();
    expect(result.status).toBe("manual_required");
  });
});
