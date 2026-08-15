import type { ExtractedProduct } from "../../domain/offer.js";
import type { PriceSnapshot, ProductRef } from "../../domain/price.js";
import type { AffiliateLinkResult } from "../../domain/affiliate-link.js";

export interface DiscoveryInput {
  query?: string;
  category?: string;
  limit?: number;
  correlationId?: string;
}

export interface DiscoveredProduct {
  externalId: string;
  canonicalUrl: string;
  title: string;
}

export interface ExtractedProductInput {
  url: URL;
}

export interface AdapterHealth {
  healthy: boolean;
  details?: Record<string, unknown>;
}

export interface SourceAdapter {
  readonly source: string;
  discover(input: DiscoveryInput): Promise<DiscoveredProduct[]>;
  extract(input: ExtractedProductInput): Promise<ExtractedProduct>;
  revalidate(product: ProductRef): Promise<PriceSnapshot>;
  createAffiliateLink?(canonicalUrl: URL): Promise<AffiliateLinkResult>;
  healthCheck(): Promise<AdapterHealth>;
}
