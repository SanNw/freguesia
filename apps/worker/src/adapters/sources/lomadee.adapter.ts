import type { SourceAdapter } from "./source-adapter.js";
import type { DiscoveredProduct, DiscoveryInput } from "./source-adapter.js";
import type { ExtractedProduct } from "../../domain/offer.js";
import type { PriceSnapshot, ProductRef } from "../../domain/price.js";
import type { AffiliateLinkResult } from "../../domain/affiliate-link.js";
import { AppError } from "../../shared/errors.js";

const LOMADEE_BASE_URL =
  process.env.LOMADEE_BASE_URL || "https://api.lomadee.com.br";
const LOMADEE_API_KEY = process.env.LOMADEE_API_KEY;
const LOMADEE_CHANNEL_ID = process.env.LOMADEE_CHANNEL_ID;
const LOMADEE_PAGE_LIMIT = Number(process.env.LOMADEE_PAGE_LIMIT) || 100;

export class LomadeeAdapter implements SourceAdapter {
  readonly source = "lomadee";

  private get headers(): Record<string, string> {
    const h: Record<string, string> = {
      Accept: "application/json",
    };
    if (LOMADEE_API_KEY) {
      h["x-api-key"] = LOMADEE_API_KEY;
    }
    return h;
  }

  async discover(input: DiscoveryInput): Promise<DiscoveredProduct[]> {
    if (!LOMADEE_API_KEY || !LOMADEE_CHANNEL_ID) {
      throw new AppError(
        "SOURCE_UNAVAILABLE",
        "Lomadee API key or channel ID not configured",
        false,
        503,
      );
    }

    const limit = input.limit ?? 20;
    const category = input.category;
    const query = input.query;

    const params = new URLSearchParams({
      channelId: LOMADEE_CHANNEL_ID,
      limit: String(Math.min(limit, LOMADEE_PAGE_LIMIT)),
    });

    if (category) {
      params.set("category", category);
    }
    if (query) {
      params.set("search", query);
    }

    const url = `${LOMADEE_BASE_URL}/affiliate/products?${params.toString()}`;

    const resp = await fetch(url, {
      headers: this.headers,
    });

    if (resp.status === 429) {
      const retryAfter = resp.headers.get("Retry-After");
      throw new AppError(
        "SOURCE_RATE_LIMITED",
        `Rate limited. Retry-After: ${retryAfter}`,
        true,
      );
    }

    if (!resp.ok) {
      throw new AppError(
        "SOURCE_UNAVAILABLE",
        `Lomadee API error: ${resp.status} ${resp.statusText}`,
        true,
      );
    }

    const data = (await resp.json()) as {
      products?: Array<{
        id: number;
        name: string;
        url: string;
        price?: number;
        originalPrice?: number;
        imageUrl?: string;
      }>;
    };

    const products = data.products || [];
    return products.map((p) => ({
      externalId: String(p.id),
      canonicalUrl: p.url,
      title: p.name,
    }));
  }

  async extract({ url }: { url: URL }): Promise<ExtractedProduct> {
    const productIdMatch =
      url.searchParams.get("productId") ||
      url.pathname.match(/\/p\/(\d+)/)?.[1];

    if (!productIdMatch) {
      throw new AppError(
        "VALIDATION_FAILED",
        "Could not extract product ID from URL",
        false,
        400,
      );
    }

    const apiUrl = `${LOMADEE_BASE_URL}/affiliate/products/${productIdMatch}?channelId=${LOMADEE_CHANNEL_ID}`;

    const resp = await fetch(apiUrl, {
      headers: this.headers,
    });

    if (!resp.ok) {
      throw new AppError(
        "SOURCE_UNAVAILABLE",
        `Failed to fetch product from Lomadee: ${resp.status}`,
        true,
      );
    }

    const product = (await resp.json()) as {
      id: number;
      name: string;
      url: string;
      price?: number;
      originalPrice?: number;
      imageUrl?: string;
      availability?: string;
      brand?: string;
      gtin?: string;
      ean?: string;
      category?: string;
    };

    const currentPriceCents = product.price
      ? Math.round(product.price * 100)
      : 0;
    const previousPriceCents = product.originalPrice
      ? Math.round(product.originalPrice * 100)
      : null;

    if (currentPriceCents <= 0) {
      throw new AppError(
        "SOURCE_SELECTOR_NOT_FOUND",
        "Product has no valid price",
        true,
      );
    }

    return {
      source: this.source,
      externalId: String(product.id),
      canonicalUrl: product.url,
      title: product.name,
      currentPriceCents,
      previousPriceCents: previousPriceCents ?? null,
      currency: "BRL",
      imageUrl: product.imageUrl || null,
      availability:
        product.availability === "in stock" ? "in_stock" : "unknown",
      seller: product.brand || null,
      rating: null,
      reviewCount: null,
      capturedAt: new Date().toISOString(),
      rawEvidence: {
        productId: product.id,
        source: "lomadee_api",
      },
    };
  }

  async revalidate(product: ProductRef): Promise<PriceSnapshot> {
    const extracted = await this.extract({
      url: new URL(product.canonicalUrl),
    });

    return {
      currentPriceCents: extracted.currentPriceCents,
      previousPriceCents: extracted.previousPriceCents ?? null,
      currency: extracted.currency,
      availability: extracted.availability,
      capturedAt: extracted.capturedAt,
    };
  }

  async createAffiliateLink(url: URL): Promise<AffiliateLinkResult> {
    if (!LOMADEE_CHANNEL_ID) {
      return {
        status: "unsupported",
        reason: "Lomadee channel ID not configured",
      };
    }

    const productIdMatch =
      url.searchParams.get("productId") ||
      url.pathname.match(/\/p\/(\d+)/)?.[1];

    if (!productIdMatch) {
      return {
        status: "unsupported",
        reason: "Cannot extract product ID to generate affiliate link",
      };
    }

    try {
      const resp = await fetch(
        `${LOMADEE_BASE_URL}/affiliate/products/${productIdMatch}/shorten?channelId=${LOMADEE_CHANNEL_ID}`,
        {
          method: "POST",
          headers: this.headers,
        },
      );

      if (!resp.ok) {
        return {
          status: "session_expired",
        };
      }

      const data = (await resp.json()) as { link?: string };
      if (data.link) {
        return {
          status: "generated",
          url: data.link,
        };
      }
      return {
        status: "session_expired",
      };
    } catch {
      return {
        status: "session_expired",
      };
    }
  }

  async healthCheck() {
    if (!LOMADEE_API_KEY) {
      return {
        healthy: false,
        details: { reason: "API key not configured" },
      };
    }

    try {
      const resp = await fetch(
        `${LOMADEE_BASE_URL}/affiliate/channels/${LOMADEE_CHANNEL_ID}`,
        {
          headers: this.headers,
        },
      );

      return {
        healthy: resp.ok,
        details: {
          status: resp.status,
          source: this.source,
        },
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        healthy: false,
        details: { error: message, source: this.source },
      };
    }
  }
}
