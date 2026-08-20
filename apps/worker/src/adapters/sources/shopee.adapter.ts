import { createHash } from "node:crypto";
import type { ExtractedProduct } from "../../domain/offer.js";
import type { PriceSnapshot, ProductRef } from "../../domain/price.js";
import type { AffiliateLinkResult } from "../../domain/affiliate-link.js";
import { marketplaceEnv as env } from "../../config/runtime.js";
import { AppError } from "../../shared/errors.js";
import { resilientFetch } from "../../shared/http-client.js";
import type {
  AdapterHealth,
  DiscoveredProduct,
  DiscoveryInput,
  ExtractedProductInput,
  SourceAdapter,
} from "./source-adapter.js";

interface ShopeeProductOffer {
  itemId: string | number;
  commissionRate?: string;
  sales?: number;
  priceMax?: string;
  priceMin?: string;
  ratingStar?: string;
  priceDiscountRate?: number;
  imageUrl?: string;
  productName?: string;
  shopId?: string | number;
  shopName?: string;
  shopType?: number[];
  productLink?: string;
  offerLink?: string;
  periodStartTime?: number;
  periodEndTime?: number;
}

interface ShopeeApiResponse {
  data?: {
    productOfferV2?: {
      nodes?: ShopeeProductOffer[];
    };
    generateShortLink?: {
      shortLink?: string;
    };
  };
  errors?: Array<{ message?: string }>;
}

export type ShopeeReadinessReason =
  | "disabled"
  | "credentials_missing"
  | "api_url_missing"
  | "ready";

export function shopeeReadiness(config: {
  enabled: boolean;
  apiUrl: string;
  appId: string;
  secret: string;
}): { ready: boolean; reason: ShopeeReadinessReason } {
  if (!config.enabled) return { ready: false, reason: "disabled" };
  if (!config.appId || !config.secret) {
    return { ready: false, reason: "credentials_missing" };
  }
  if (!config.apiUrl) return { ready: false, reason: "api_url_missing" };
  return { ready: true, reason: "ready" };
}

export function shopeeAuthorization(
  appId: string,
  secret: string,
  payload: string,
  timestamp: number,
): string {
  const signature = createHash("sha256")
    .update(`${appId}${timestamp}${payload}${secret}`)
    .digest("hex");
  return `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${signature}`;
}

function cents(value: string | undefined): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) : null;
}

function previousPrice(current: number, discount: number | undefined) {
  if (!discount || discount <= 0 || discount >= 100) return null;
  return Math.round(current / (1 - discount / 100));
}

export class ShopeeAdapter implements SourceAdapter {
  readonly source = "shopee";
  private readonly cache = new Map<string, ShopeeProductOffer>();

  private readiness() {
    return shopeeReadiness({
      enabled: env.SOURCE_SHOPEE_ENABLED,
      apiUrl: env.SHOPEE_AFFILIATE_API_URL,
      appId: env.SHOPEE_APP_ID,
      secret: env.SHOPEE_SECRET,
    });
  }

  private async api(query: string): Promise<ShopeeApiResponse> {
    const readiness = this.readiness();
    if (!readiness.ready) {
      throw new AppError(
        "SOURCE_UNAVAILABLE",
        `Shopee integration is ${readiness.reason}`,
        false,
        503,
      );
    }
    const payload = JSON.stringify({ query });
    const timestamp = Math.floor(Date.now() / 1000);
    const response = await resilientFetch(env.SHOPEE_AFFILIATE_API_URL, {
      method: "POST",
      headers: {
        Authorization: shopeeAuthorization(
          env.SHOPEE_APP_ID,
          env.SHOPEE_SECRET,
          payload,
          timestamp,
        ),
        "Content-Type": "application/json",
      },
      body: payload,
      source: "shopee-api",
    });
    const result = (await response.json()) as ShopeeApiResponse;
    if (!response.ok || result.errors?.length) {
      throw new AppError(
        "SOURCE_UNAVAILABLE",
        result.errors?.[0]?.message ?? `Shopee API error ${response.status}`,
        response.status >= 500 || response.status === 429,
        response.ok ? 502 : response.status,
      );
    }
    return result;
  }

  async discover(input: DiscoveryInput): Promise<DiscoveredProduct[]> {
    const limit = Math.min(Math.max(input.limit ?? 20, 1), 50);
    const args = [
      input.query ? `keyword: ${JSON.stringify(input.query)}` : null,
      input.category ? `productCatId: ${Number(input.category)}` : null,
      "sortType: 2",
      "page: 1",
      `limit: ${limit}`,
    ].filter(Boolean);
    const result = await this.api(`{
      productOfferV2(${args.join(", ")}) {
        nodes {
          itemId commissionRate sales priceMax priceMin ratingStar
          priceDiscountRate imageUrl productName shopId shopName shopType
          productLink offerLink periodStartTime periodEndTime
        }
      }
    }`);
    return (result.data?.productOfferV2?.nodes ?? []).flatMap((product) => {
      const externalId = String(product.itemId ?? "");
      const url = product.productLink;
      const title = product.productName;
      if (!externalId || !url || !title) return [];
      this.cache.set(url, product);
      return [{ externalId, canonicalUrl: url, title }];
    });
  }

  async extract({ url }: ExtractedProductInput): Promise<ExtractedProduct> {
    const product = this.cache.get(url.toString());
    if (!product) {
      throw new AppError(
        "SOURCE_UNAVAILABLE",
        "Shopee product is not present in the current discovery batch",
        true,
        409,
      );
    }
    const currentPriceCents = cents(product.priceMin);
    if (!currentPriceCents) {
      throw new AppError(
        "SOURCE_UNAVAILABLE",
        "Shopee returned an invalid price",
        true,
      );
    }
    return {
      source: this.source,
      externalId: String(product.itemId),
      canonicalUrl: url.toString(),
      title: product.productName ?? `Shopee ${product.itemId}`,
      currentPriceCents,
      previousPriceCents: previousPrice(
        currentPriceCents,
        product.priceDiscountRate,
      ),
      currency: "BRL",
      imageUrl: product.imageUrl ?? null,
      availability: "in_stock",
      seller: product.shopName ?? "Shopee",
      rating: product.ratingStar ? Number(product.ratingStar) : null,
      reviewCount: null,
      capturedAt: new Date().toISOString(),
      rawEvidence: {
        source: "shopee_affiliate_api",
        offerLink: product.offerLink ?? null,
        sales: product.sales ?? null,
        commissionRate: product.commissionRate ?? null,
        shopId: product.shopId ?? null,
        shopType: product.shopType ?? [],
        priceMax: product.priceMax ?? null,
        priceDiscountRate: product.priceDiscountRate ?? null,
        periodStartTime: product.periodStartTime ?? null,
        periodEndTime: product.periodEndTime ?? null,
      },
    };
  }

  async revalidate(product: ProductRef): Promise<PriceSnapshot> {
    const found = await this.discover({ query: product.externalId, limit: 10 });
    const match = found.find((item) => item.externalId === product.externalId);
    if (!match) {
      throw new AppError("SOURCE_UNAVAILABLE", "Shopee product not found", true);
    }
    const extracted = await this.extract({ url: new URL(match.canonicalUrl) });
    return {
      currentPriceCents: extracted.currentPriceCents,
      previousPriceCents: extracted.previousPriceCents ?? null,
      currency: extracted.currency,
      availability: extracted.availability,
      capturedAt: extracted.capturedAt,
    };
  }

  async createAffiliateLink(canonicalUrl: URL): Promise<AffiliateLinkResult> {
    const link = this.cache.get(canonicalUrl.toString())?.offerLink;
    if (link) return { status: "generated", url: link };

    const result = await this.api(`mutation {
      generateShortLink(input: {
        originUrl: ${JSON.stringify(canonicalUrl.toString())}
        subIds: ["freguesia"]
      }) {
        shortLink
      }
    }`);
    const shortLink = result.data?.generateShortLink?.shortLink;
    return shortLink
      ? { status: "generated", url: shortLink }
      : { status: "unsupported", reason: "short_link_missing" };
  }

  async healthCheck(): Promise<AdapterHealth> {
    const readiness = this.readiness();
    if (!readiness.ready) {
      return { healthy: false, details: { reason: readiness.reason } };
    }
    try {
      await this.discover({ query: "ofertas", limit: 1 });
      return { healthy: true, details: { reason: "connected" } };
    } catch (error) {
      return {
        healthy: false,
        details: {
          reason: error instanceof Error ? error.message : "api_error",
        },
      };
    }
  }
}
