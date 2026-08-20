import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/config/env.js", () => ({
  env: {
    SOURCE_SHOPEE_ENABLED: true,
    SHOPEE_APP_ID: "app",
    SHOPEE_SECRET: "secret",
    SHOPEE_AFFILIATE_API_URL: "https://example.com/graphql",
  },
}));

const { ShopeeAdapter, shopeeAuthorization, shopeeReadiness } =
  await import("../../src/adapters/sources/shopee.adapter.js");

describe("Shopee adapter", () => {
  it("reports configuration readiness", () => {
    expect(
      shopeeReadiness({ enabled: false, apiUrl: "", appId: "", secret: "" }),
    ).toEqual({ ready: false, reason: "disabled" });
    expect(
      shopeeReadiness({
        enabled: true,
        apiUrl: "https://example.com/graphql",
        appId: "app",
        secret: "secret",
      }),
    ).toEqual({ ready: true, reason: "ready" });
  });

  it("signs the exact request payload with SHA-256", () => {
    const payload = JSON.stringify({ query: "{ productOfferV2 { nodes { itemId } } }" });
    const timestamp = 1_577_836_800;
    const signature = createHash("sha256")
      .update(`123456${timestamp}${payload}demo`)
      .digest("hex");
    expect(shopeeAuthorization("123456", "demo", payload, timestamp)).toBe(
      `SHA256 Credential=123456, Timestamp=${timestamp}, Signature=${signature}`,
    );
  });

  it("generates a tracked short link when the offer has no affiliate link", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            generateShortLink: { shortLink: "https://s.shopee.com.br/demo" },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      new ShopeeAdapter().createAffiliateLink(
        new URL("https://shopee.com.br/produto-i.1.2"),
      ),
    ).resolves.toEqual({
      status: "generated",
      url: "https://s.shopee.com.br/demo",
    });

    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).query).toContain(
      "generateShortLink",
    );
  });
});
