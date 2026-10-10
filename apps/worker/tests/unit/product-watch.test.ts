import { describe, expect, it } from "vitest";
import {
  parseProductIdentity,
  promotionFingerprint,
  isNewPromotion,
} from "../../src/domain/product-watch.js";
import {
  resolveProductUrl,
  isPublicAddress,
} from "../../src/shared/product-watch-url.js";

describe("exact watched product identity", () => {
  it.each([
    ["https://shopee.com.br/product/12/34?utm_source=x", "shopee:12:34"],
    [
      "https://shopee.com.br/placa-i.12.34?model_id=99",
      "shopee:12:34:variant:99",
    ],
    ["https://shopee.com.br/product/13/34", "shopee:13:34"],
    ["https://www.kabum.com.br/produto/12345/placa", "kabum:12345"],
    [
      "https://www.amazon.com.br/dp/B012345678?tag=someone",
      "amazon:B012345678",
    ],
    [
      "https://produto.mercadolivre.com.br/MLB-123456-placa-_JM",
      "mercadolivre:item:MLB123456",
    ],
    [
      "https://www.mercadolivre.com.br/placa/p/MLB123456",
      "mercadolivre:catalog:MLB123456",
    ],
    [
      "https://pt.aliexpress.com/item/1005001234567.html?sku_id=123",
      "aliexpress:1005001234567:variant:123",
    ],
  ])("recognizes %s without title matching", (url, key) => {
    expect(parseProductIdentity(url)?.key).toBe(key);
    expect(parseProductIdentity(url)?.canonicalUrl).not.toMatch(
      /utm_source|tag=someone/,
    );
  });
  it.each([
    "https://shopee.com.br.evil.test/product/12/34",
    "http://shopee.com.br/product/12/34",
    "https://user:pass@shopee.com.br/product/12/34",
    "https://shopee.com.br:444/product/12/34",
    "https://shopee.com.br/cart",
    "https://amazon.com.br/ap/signin",
    "https://shopee.com.br/product/12/34?model_id=1&model_id=2",
  ])("refuses nonproduct or unsafe input %s", (url) => {
    expect(parseProductIdentity(url)).toBeNull();
  });
  it("suppresses the baseline, identical price/coupon, and a higher price", () => {
    expect(promotionFingerprint(10000, "SAVE")).toBe(
      promotionFingerprint(10000, "SAVE"),
    );
    expect(
      isNewPromotion(
        { priceCents: 10000, coupon: "SAVE" },
        { priceCents: 10000, coupon: "SAVE" },
      ),
    ).toBe(false);
    expect(
      isNewPromotion(
        { priceCents: 10000, coupon: "SAVE" },
        { priceCents: 11000, coupon: "NEW" },
      ),
    ).toBe(false);
    expect(
      isNewPromotion(
        { priceCents: 10000, coupon: "SAVE" },
        { priceCents: 9000, coupon: "SAVE" },
      ),
    ).toBe(true);
    expect(
      isNewPromotion(
        { priceCents: 10000, coupon: "SAVE" },
        { priceCents: 10000, coupon: "NEW" },
      ),
    ).toBe(true);
  });
});

describe("safe short URL resolution", () => {
  it.each([
    "127.0.0.1",
    "10.1.1.1",
    "169.254.169.254",
    "192.168.1.2",
    "100.64.0.1",
    "198.18.0.1",
    "::1",
    "fe80::1",
    "fc00::1",
    "::ffff:127.0.0.1",
    "2001:db8::1",
  ])("blocks nonpublic %s", (ip) => expect(isPublicAddress(ip)).toBe(false));
  it.each(["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"])(
    "allows public %s",
    (ip) => expect(isPublicAddress(ip)).toBe(true),
  );
  it("pins DNS at each redirect and strips another affiliate", async () => {
    const requests: string[] = [];
    const product = await resolveProductUrl(
      "https://s.shopee.com.br/referral",
      {
        lookup: async () => [{ address: "8.8.8.8", family: 4 }],
        request: async (url, address) => {
          requests.push(`${url.hostname}:${address.address}`);
          return {
            statusCode: 302,
            location: "https://shopee.com.br/product/12/34?affiliate_id=evil",
          };
        },
      },
    );
    expect(requests).toEqual(["s.shopee.com.br:8.8.8.8"]);
    expect(product.canonicalUrl).toBe("https://shopee.com.br/product/12/34");
  });
  it("rejects private DNS without connecting", async () => {
    let connected = false;
    await expect(
      resolveProductUrl("https://amzn.to/test", {
        lookup: async () => [{ address: "127.0.0.1", family: 4 }],
        request: async () => {
          connected = true;
          return { statusCode: 200 };
        },
      }),
    ).rejects.toThrow(/públic|public/i);
    expect(connected).toBe(false);
  });
  it("rejects a redirect to a forbidden host before DNS or connection", async () => {
    let lookups = 0;
    await expect(
      resolveProductUrl("https://amzn.to/test", {
        lookup: async () => {
          lookups++;
          return [{ address: "8.8.8.8", family: 4 }];
        },
        request: async () => ({
          statusCode: 302,
          location: "https://127.0.0.1/private",
        }),
      }),
    ).rejects.toThrow(/permit|suport|allowed/i);
    expect(lookups).toBe(1);
  });
  it("rejects mixed public/private DNS and redirect loops", async () => {
    await expect(
      resolveProductUrl("https://amzn.to/test", {
        lookup: async () => [
          { address: "8.8.8.8", family: 4 },
          { address: "10.0.0.1", family: 4 },
        ],
        request: async () => ({ statusCode: 200 }),
      }),
    ).rejects.toThrow(/públic|public/i);
    await expect(
      resolveProductUrl("https://amzn.to/test", {
        lookup: async () => [{ address: "8.8.8.8", family: 4 }],
        request: async () => ({
          statusCode: 302,
          location: "https://amzn.to/test",
        }),
      }),
    ).rejects.toThrow(/redirecion/i);
  });
});
