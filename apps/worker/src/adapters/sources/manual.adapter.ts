import type { SourceAdapter } from "./source-adapter.js";
import type { ExtractedProduct } from "../../domain/offer.js";
import type { PriceSnapshot, ProductRef } from "../../domain/price.js";
import type { AffiliateLinkResult } from "../../domain/affiliate-link.js";

export class ManualAdapter implements SourceAdapter {
  readonly source = "manual";

  async discover() {
    return [];
  }

  async extract(): Promise<ExtractedProduct> {
    throw new Error("Manual adapter does not extract from URLs");
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
    return {
      status: "manual_required",
      reason: "Manual adapter requires human-provided affiliate link",
    };
  }

  async healthCheck() {
    return { healthy: true };
  }
}
