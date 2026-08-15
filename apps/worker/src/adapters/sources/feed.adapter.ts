import type { SourceAdapter } from "./source-adapter.js";
import type { ExtractedProduct } from "../../domain/offer.js";
import type { PriceSnapshot, ProductRef } from "../../domain/price.js";
import type { AffiliateLinkResult } from "../../domain/affiliate-link.js";

export interface FeedConfig {
  url: string;
  format: "csv" | "xml" | "json";
  store: string;
}

export class FeedAdapter implements SourceAdapter {
  readonly source: string;

  constructor(private readonly config: FeedConfig) {
    this.source = `feed:${config.store}`;
  }

  async discover() {
    const response = await fetch(this.config.url, {
      headers: { Accept: "application/json, application/xml, text/csv" },
    });
    if (!response.ok) {
      throw new Error(`Feed fetch failed: ${response.status}`);
    }
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("json")) {
      return this.parseJson(await response.json());
    }
    throw new Error(`Unsupported feed content-type: ${contentType}`);
  }

  private parseJson(data: unknown) {
    if (!Array.isArray(data)) {
      data = [data];
    }
    const items = data as Record<string, unknown>[];
    return items
      .filter((item) => item.id || item.url || item.link)
      .map((item) => ({
        externalId: String(item.id ?? item.url ?? item.link ?? ""),
        canonicalUrl: String(item.url ?? item.link ?? ""),
        title: String(item.title ?? item.name ?? ""),
      }));
  }

  async extract(): Promise<ExtractedProduct> {
    throw new Error("FeedAdapter does not extract from individual URLs");
  }

  async revalidate(product: ProductRef): Promise<PriceSnapshot> {
    return {
      currentPriceCents: 0,
      previousPriceCents: null,
      currency: "BRL",
      availability: "unknown",
      capturedAt: new Date().toISOString(),
    };
  }

  async createAffiliateLink(canonicalUrl: URL): Promise<AffiliateLinkResult> {
    return { status: "unsupported", reason: "Feed adapter does not generate affiliate links" };
  }

  async healthCheck() {
    try {
      const resp = await fetch(this.config.url, { method: "HEAD" });
      return { healthy: resp.ok, details: { status: resp.status } };
    } catch (e) {
      return { healthy: false, details: { error: (e as Error).message } };
    }
  }
}
