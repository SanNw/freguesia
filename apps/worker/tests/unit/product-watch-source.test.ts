import { describe, expect, it, vi } from "vitest";
vi.mock("../../src/config/env.js", () => ({ env: {} }));
import { WatchedProductSource } from "../../src/adapters/sources/watched-product-source.js";
import { parseProductIdentity } from "../../src/domain/product-watch.js";
const identity = parseProductIdentity("https://shopee.com.br/product/12/34")!;
const config = {
  SOURCE_SHOPEE_ENABLED: true,
  SHOPEE_AFFILIATE_API_URL: "https://open-api.affiliate.shopee.com.br/graphql",
  SHOPEE_APP_ID: "test",
  SHOPEE_SECRET: "test",
};
const node = {
  itemId: "34",
  shopId: "12",
  productLink: identity.canonicalUrl,
  productName: "Placa",
  priceMin: "100.00",
  priceMax: "100.00",
  periodStartTime: 1,
  periodEndTime: 4102444800,
};
function setup(product = node) {
  const bodies: string[] = [];
  const fetcher = async (_url: string, options: RequestInit) => {
    bodies.push(String(options.body));
    expect(
      String((options.headers as Record<string, string>).Authorization),
    ).toContain("SHA256 Credential=test");
    return new Response(
      JSON.stringify(
        bodies.length === 1
          ? { data: { productOfferV2: { nodes: [product] } } }
          : {
              data: {
                generateShortLink: { shortLink: "https://s.shopee.com.br/own" },
              },
            },
      ),
      { status: 200 },
    );
  };
  return {
    source: new WatchedProductSource(
      {
        catalogCandidates: async () => [],
        publishedOffer: async () => null,
      } as never,
      config,
      fetcher,
    ),
    bodies,
  };
}
describe("exact direct Shopee lookup", () => {
  it("does not report a cheaper historical catalog price over a fresh higher price", async () => {
    const row = {
      offer_id: "catalog",
      canonical_url: identity.canonicalUrl,
      title: "Placa",
      affiliate_url: "https://s.shopee.com.br/catalog-own",
      affiliate_provider: "shopee",
      current_price_cents: "5000",
      coupon_code: null,
    };
    let requests = 0;
    const source = new WatchedProductSource(
      { catalogCandidates: async () => [row] } as never,
      config,
      async () => {
        requests++;
        return new Response(
          JSON.stringify(
            requests === 1
              ? { data: { productOfferV2: { nodes: [node] } } }
              : {
                  data: {
                    generateShortLink: {
                      shortLink: "https://s.shopee.com.br/own",
                    },
                  },
                },
          ),
          { status: 200 },
        );
      },
    );
    expect(await source.check(identity)).toMatchObject({
      priceCents: 10000,
      affiliateUrl: "https://s.shopee.com.br/own",
    });
  });
  it("uses exact item/shop arguments and generates its own link", async () => {
    const { source, bodies } = setup();
    const result = await source.check(identity);
    expect(bodies[0]).toContain("itemId: 34, shopId: 12");
    expect(bodies[1]).toContain("generateShortLink");
    expect(result).toMatchObject({
      priceCents: 10000,
      affiliateUrl: "https://s.shopee.com.br/own",
      availability: "unknown",
    });
  });
  it.each([
    { ...node, shopId: "99" },
    { ...node, itemId: "99" },
    { ...node, priceMax: "200" },
    { ...node, priceMin: "0" },
    { ...node, periodEndTime: 1 },
    { ...node, periodStartTime: 4102444800 },
    { ...node, stock: 0 },
  ])(
    "refuses wrong identity/variant price/availability %j",
    async (product) => {
      const { source, bodies } = setup(product);
      expect(await source.check(identity)).toBeNull();
      expect(bodies).toHaveLength(1);
    },
  );
  it("refuses an explicit variant that API cannot verify", async () => {
    const { source } = setup();
    expect(
      await source.check({
        ...identity,
        variantId: "77",
        key: "shopee:12:34:variant:77",
      }),
    ).toBeNull();
  });
  it("does not bypass unavailable API credentials or unsupported stores", async () => {
    const source = new WatchedProductSource(
      { catalogCandidates: async () => [] } as never,
      { ...config, SHOPEE_SECRET: "" },
      async () => {
        throw new Error("must not request");
      },
    );
    expect(await source.check(identity)).toBeNull();
    expect(
      await source.check(
        parseProductIdentity("https://www.kabum.com.br/produto/12345")!,
      ),
    ).toBeNull();
  });
  it("checks a newer direct price even when an approved catalog price exists", async () => {
    const { bodies } = setup();
    const row = {
      offer_id: "catalog",
      canonical_url: identity.canonicalUrl,
      title: "Placa",
      affiliate_url: "https://s.shopee.com.br/catalog-own",
      affiliate_provider: "shopee",
      current_price_cents: "15000",
      coupon_code: null,
    };
    const source = new WatchedProductSource(
      { catalogCandidates: async () => [row] } as never,
      config,
      async (_url, options) => {
        bodies.push(String(options.body));
        return new Response(
          JSON.stringify(
            bodies.length === 1
              ? { data: { productOfferV2: { nodes: [node] } } }
              : {
                  data: {
                    generateShortLink: {
                      shortLink: "https://s.shopee.com.br/own",
                    },
                  },
                },
          ),
          { status: 200 },
        );
      },
    );
    expect(await source.check(identity)).toMatchObject({
      priceCents: 10000,
      affiliateUrl: "https://s.shopee.com.br/own",
    });
  });
  it("ignores a same-named catalog item from another shop or variant", async () => {
    const row = {
      offer_id: "catalog",
      canonical_url: "https://shopee.com.br/product/99/34",
      title: "Placa",
      affiliate_url: "https://s.shopee.com.br/catalog-own",
      affiliate_provider: "shopee",
      current_price_cents: "15000",
      coupon_code: null,
    };
    const source = new WatchedProductSource(
      { catalogCandidates: async () => [row] } as never,
      { ...config, SHOPEE_SECRET: "" },
    );
    expect(await source.check(identity)).toBeNull();
    expect(
      await source.catalog({
        ...identity,
        variantId: "77",
        key: "shopee:12:34:variant:77",
      }),
    ).toBeNull();
  });
  it("rejects numeric API identities that have already lost integer precision", async () => {
    const large = {
      ...identity,
      itemId: "9007199254740992",
      key: "shopee:12:9007199254740992",
      canonicalUrl: "https://shopee.com.br/product/12/9007199254740992",
    };
    const { source } = setup({
      ...node,
      itemId: 9007199254740992,
      productLink: large.canonicalUrl,
    } as never);
    expect(await source.check(large)).toBeNull();
  });
});
