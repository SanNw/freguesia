import type { SourceAdapter } from "./source-adapter.js";
import type { DiscoveredProduct, DiscoveryInput } from "./source-adapter.js";
import type { ExtractedProduct } from "../../domain/offer.js";
import type { PriceSnapshot, ProductRef } from "../../domain/price.js";
import type { AffiliateLinkResult } from "../../domain/affiliate-link.js";
import { AppError } from "../../shared/errors.js";

const AWIN_BASE_URL = process.env.AWIN_BASE_URL || "https://api.awin.com";
const AWIN_API_TOKEN = process.env.AWIN_API_TOKEN;
const AWIN_PUBLISHER_ID = process.env.AWIN_PUBLISHER_ID;
const AWIN_PAGE_SIZE = Number(process.env.AWIN_PAGE_SIZE) || 200;

export class AwinAdapter implements SourceAdapter {
  readonly source = "awin";

  private get headers(): Record<string, string> {
    const h: Record<string, string> = {
      Accept: "application/json",
    };
    if (AWIN_API_TOKEN) {
      h.Authorization = `Bearer ${AWIN_API_TOKEN}`;
    }
    return h;
  }

  private buildUrl(
    path: string,
    params: Record<string, string | number>,
  ): string {
    const url = new URL(`${AWIN_BASE_URL}${path}`);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value));
    }
    return url.toString();
  }

  async discover(input: DiscoveryInput): Promise<DiscoveredProduct[]> {
    if (!AWIN_API_TOKEN || !AWIN_PUBLISHER_ID) {
      throw new AppError(
        "SOURCE_UNAVAILABLE",
        "Awin API token or publisher ID not configured",
        false,
        503,
      );
    }

    const limit = input.limit ?? 20;
    const category = input.category;

    const params: Record<string, string | number> = {
      publisherId: AWIN_PUBLISHER_ID,
      pageSize: Math.min(limit, AWIN_PAGE_SIZE),
    };

    if (category) {
      params.category = category;
    }

    const url = this.buildUrl("/promotions", params);

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
        `Awin API error: ${resp.status} ${resp.statusText}`,
        true,
      );
    }

    const data = (await resp.json()) as Array<{
      id: string;
      title: string;
      urlTracking?: string;
      destinationUrl?: string;
    }>;

    return data.map((item) => ({
      externalId: item.id,
      canonicalUrl: item.urlTracking || item.destinationUrl || "",
      title: item.title,
    }));
  }

  async extract({ url }: { url: URL }): Promise<ExtractedProduct> {
    const id = extractIdFromUrl(url);

    const offerUrl = this.buildUrl("/promotions", {
      publisherId: AWIN_PUBLISHER_ID || "",
      id,
    });

    const resp = await fetch(offerUrl, {
      headers: this.headers,
    });

    if (!resp.ok) {
      throw new AppError(
        "SOURCE_UNAVAILABLE",
        `Failed to fetch offer from Awin: ${resp.status}`,
        true,
      );
    }

    const data = (await resp.json()) as {
      id: string;
      title: string;
      urlTracking?: string;
      destinationUrl?: string;
      deepLink?: string;
      buttonUrl?: string;
      merchantId?: string;
      advertiserId?: string;
      advertiserName?: string;
      currency?: string;
      price?: number;
      originalPrice?: number;
      imageUrl?: string;
    };

    const currentPriceCents = data.price ? Math.round(data.price * 100) : 0;
    const previousPriceCents = data.originalPrice
      ? Math.round(data.originalPrice * 100)
      : null;

    if (currentPriceCents <= 0) {
      throw new AppError(
        "SOURCE_SELECTOR_NOT_FOUND",
        "Offer has no valid price",
        true,
      );
    }

    const canonicalUrl =
      data.urlTracking ||
      data.deepLink ||
      data.buttonUrl ||
      data.destinationUrl ||
      "";

    return {
      source: this.source,
      externalId: data.id,
      canonicalUrl,
      title: data.title,
      currentPriceCents,
      previousPriceCents: previousPriceCents ?? null,
      currency: data.currency || "BRL",
      imageUrl: data.imageUrl || null,
      availability: "in_stock",
      seller: data.advertiserName || null,
      rating: null,
      reviewCount: null,
      capturedAt: new Date().toISOString(),
      rawEvidence: {
        offerId: data.id,
        merchantId: data.merchantId,
        advertiserId: data.advertiserId,
        source: "awin_promotions",
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
    if (!AWIN_API_TOKEN) {
      return {
        status: "unsupported",
        reason: "Awin token not configured",
      };
    }

    const id = extractIdFromUrl(url);

    try {
      const resp = await fetch(
        `${AWIN_BASE_URL}/publishers/${AWIN_PUBLISHER_ID}/linkbuilder/generate`,
        {
          method: "POST",
          headers: {
            ...this.headers,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            destinationUrl: url.toString(),
            parameters: {
              campaign: "freguesia_telegram",
              clickref: `offer-${id}`,
            },
            shorten: false,
          }),
        },
      );

      if (!resp.ok) {
        return {
          status: "session_expired",
        };
      }

      const data = (await resp.json()) as {
        generatedLink?: string;
        link?: string;
      };

      const link = data.generatedLink || data.link;
      if (link) {
        return {
          status: "generated",
          url: link,
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
    if (!AWIN_API_TOKEN) {
      return {
        healthy: false,
        details: { reason: "API token not configured" },
      };
    }

    try {
      const resp = await fetch(
        this.buildUrl("/accounts", { type: "publisher" }),
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

function extractIdFromUrl(url: URL): string {
  const id = url.searchParams.get("id") || url.searchParams.get("promotionId");
  if (id) return id;
  const pathParts = url.pathname.split("/");
  const lastPart = pathParts[pathParts.length - 1];
  return lastPart || url.toString();
}
