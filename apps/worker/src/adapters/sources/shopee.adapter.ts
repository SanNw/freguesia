import type { ExtractedProduct } from "../../domain/offer.js";
import type { PriceSnapshot, ProductRef } from "../../domain/price.js";
import type { AffiliateLinkResult } from "../../domain/affiliate-link.js";
import { env } from "../../config/env.js";
import { AppError } from "../../shared/errors.js";
import type {
  AdapterHealth,
  DiscoveredProduct,
  DiscoveryInput,
  ExtractedProductInput,
  SourceAdapter,
} from "./source-adapter.js";

export type ShopeeReadinessReason =
  "disabled" | "credentials_missing" | "api_contract_pending";

export function shopeeReadiness(config: {
  enabled: boolean;
  appId: string;
  secret: string;
}): { ready: false; reason: ShopeeReadinessReason } {
  if (!config.enabled) return { ready: false, reason: "disabled" };
  if (!config.appId || !config.secret) {
    return { ready: false, reason: "credentials_missing" };
  }
  return { ready: false, reason: "api_contract_pending" };
}

function pendingError(): AppError {
  return new AppError(
    "SOURCE_UNAVAILABLE",
    "Shopee API access is awaiting the official credentials and contract",
    false,
    503,
  );
}

export class ShopeeAdapter implements SourceAdapter {
  readonly source = "shopee";

  async discover(_input: DiscoveryInput): Promise<DiscoveredProduct[]> {
    throw pendingError();
  }

  async extract(_input: ExtractedProductInput): Promise<ExtractedProduct> {
    throw pendingError();
  }

  async revalidate(_product: ProductRef): Promise<PriceSnapshot> {
    throw pendingError();
  }

  async createAffiliateLink(_canonicalUrl: URL): Promise<AffiliateLinkResult> {
    return { status: "unsupported", reason: "shopee_api_contract_pending" };
  }

  async healthCheck(): Promise<AdapterHealth> {
    const readiness = shopeeReadiness({
      enabled: env.SOURCE_SHOPEE_ENABLED,
      appId: env.SHOPEE_APP_ID,
      secret: env.SHOPEE_SECRET,
    });
    return {
      healthy: false,
      details: {
        reason: readiness.reason,
        apiUrlConfigured: Boolean(env.SHOPEE_AFFILIATE_API_URL),
      },
    };
  }
}
