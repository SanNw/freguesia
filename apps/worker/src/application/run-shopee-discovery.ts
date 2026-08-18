import type { Logger } from "../config/logger.js";
import { ShopeeAdapter } from "../adapters/sources/shopee.adapter.js";

export async function runShopeeDiscovery(logger: Logger) {
  const health = await new ShopeeAdapter().healthCheck();
  const reason = String(health.details?.reason ?? "api_contract_pending");
  logger.info({ reason }, "Shopee discovery is waiting for API activation");
  return {
    status: "awaiting_api_access" as const,
    source: "shopee",
    reason,
    discovered: 0,
    created: 0,
    failed: 0,
  };
}
