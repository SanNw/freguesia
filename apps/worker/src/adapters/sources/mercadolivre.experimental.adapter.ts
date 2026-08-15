import type { SourceAdapter } from "./source-adapter.js";
import type { ExtractedProduct } from "../../domain/offer.js";
import type { PriceSnapshot, ProductRef } from "../../domain/price.js";
import type { AffiliateLinkResult } from "../../domain/affiliate-link.js";

export class MercadolivreExperimentalAdapter implements SourceAdapter {
  readonly source = "mercadolivre-experimental";

  async discover() {
    return [];
  }

  async extract(): Promise<ExtractedProduct> {
    throw new Error("Mercado Livre adapter is experimental and disabled by default");
  }

  async revalidate(_product: ProductRef): Promise<PriceSnapshot> {
    throw new Error("Mercado Livre adapter is experimental and disabled by default");
  }

  async createAffiliateLink(_canonicalUrl: URL): Promise<AffiliateLinkResult> {
    return { status: "manual_required", reason: "Mercado Livre affiliate links require manual insertion" };
  }

  async healthCheck() {
    return { healthy: false, details: { reason: "experimental_adapter_disabled" } };
  }
}
