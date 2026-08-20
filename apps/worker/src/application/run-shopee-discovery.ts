import type { Logger } from "../config/logger.js";
import { db } from "../adapters/persistence/db.js";
import { productRepository } from "../adapters/persistence/product-repository.js";
import { priceObservationRepository } from "../adapters/persistence/price-observation-repository.js";
import { offerRepository } from "../adapters/persistence/offer-repository.js";
import { ShopeeAdapter } from "../adapters/sources/shopee.adapter.js";
import { validateOffer } from "./validate-offer.js";
import { scoreOffer } from "./score.js";
import {
  generateIdempotencyKey,
  isUnchangedPrice,
} from "./offer-helpers.js";
import { buildCaption } from "./create-manual-offer.js";
import { requestApproval } from "./request-approval.js";

export interface ShopeeDiscoveryInput {
  query?: string;
  limit: number;
  correlationId?: string;
}

async function sourceId(): Promise<string> {
  const rows = await db.query<{ id: string }>(
    `INSERT INTO sources (slug, name, store, type, adapter_version, enabled)
     VALUES ('shopee', 'Shopee', 'Shopee', 'api', '2.0.0', TRUE)
     ON CONFLICT (slug) DO UPDATE SET enabled = TRUE, adapter_version = EXCLUDED.adapter_version, updated_at = NOW()
     RETURNING id`,
  );
  return rows[0].id;
}

async function imageReachable(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      headers: { Range: "bytes=0-1023" },
      signal: AbortSignal.timeout(5_000),
    });
    const valid =
      response.ok &&
      (response.headers.get("content-type") ?? "")
        .toLowerCase()
        .startsWith("image/");
    if (response.body) await response.body.cancel();
    return valid;
  } catch {
    return false;
  }
}

export async function runShopeeDiscovery(
  input: ShopeeDiscoveryInput,
  logger: Logger,
) {
  const adapter = new ShopeeAdapter();
  const health = await adapter.healthCheck();
  if (!health.healthy) {
    throw new Error(String(health.details?.reason ?? "Shopee unavailable"));
  }
  const candidates = await adapter.discover({
    ...input,
    limit: input.limit * 5,
  });
  const shopeeSourceId = await sourceId();
  const result = {
    status: "completed" as const,
    source: "shopee",
    discovered: candidates.length,
    created: 0,
    approvalRequested: 0,
    skipped: 0,
    failed: 0,
    offerIds: [] as string[],
    skippedReasons: {} as Record<string, number>,
  };
  const skip = (reason: string) => {
    result.skipped += 1;
    result.skippedReasons[reason] = (result.skippedReasons[reason] ?? 0) + 1;
  };

  for (const candidate of candidates) {
    if (result.created >= input.limit) break;
    try {
      const extracted = await adapter.extract({
        url: new URL(candidate.canonicalUrl),
      });
      const lastPrice =
        await offerRepository.findLastSeenPriceBySourceAndExternal(
          "shopee",
          candidate.externalId,
        );
      if (isUnchangedPrice(lastPrice, extracted.currentPriceCents)) {
        skip("unchanged_price");
        continue;
      }
      const validation = validateOffer(extracted);
      if (
        !validation.valid &&
        validation.reason !== "DISCOUNT_TOO_HIGH_REVIEW"
      ) {
        skip(validation.reason ?? "validation_failed");
        continue;
      }
      const affiliate = await adapter.createAffiliateLink(
        new URL(extracted.canonicalUrl),
      );
      if (affiliate.status !== "generated") {
        skip("affiliate_link_failed");
        continue;
      }
      if (!extracted.imageUrl || !(await imageReachable(extracted.imageUrl))) {
        skip("image_unreachable");
        continue;
      }
      const discountPercent = validation.discountPercent ?? null;
      const score = scoreOffer({
        discountPercent,
        currentPriceCents: extracted.currentPriceCents,
        previousPriceCents: extracted.previousPriceCents ?? null,
        sourceReliability: 18,
        availability: extracted.availability,
        rating: extracted.rating ?? null,
        reviewCount: null,
        nicheMatch: 10,
        hasPreviousPriceEvidence: !!extracted.previousPriceCents,
        titleComplete: extracted.title.length >= 5,
        hasImage: true,
        isExperimental: false,
      });
      const product = await productRepository.upsert({
        sourceId: shopeeSourceId,
        externalId: extracted.externalId,
        canonicalUrl: extracted.canonicalUrl,
        title: extracted.title,
        normalizedTitle: extracted.title.toLowerCase().trim(),
        brand: null,
        category: null,
        currency: extracted.currency,
        imageUrl: extracted.imageUrl,
        availability: extracted.availability,
      });
      const observation = await priceObservationRepository.insert({
        productId: product.id,
        currentPriceCents: extracted.currentPriceCents,
        previousPriceCents: extracted.previousPriceCents ?? null,
        currency: extracted.currency,
        availability: extracted.availability,
        evidence: extracted.rawEvidence,
        capturedAt: extracted.capturedAt,
      });
      const offerId = crypto.randomUUID();
      const caption = buildCaption(
        {
          title: extracted.title,
          canonicalUrl: extracted.canonicalUrl,
          affiliateUrl: affiliate.url,
          currentPriceCents: extracted.currentPriceCents,
          previousPriceCents: extracted.previousPriceCents ?? null,
          currency: extracted.currency,
          imageUrl: extracted.imageUrl,
          store: extracted.seller ?? "Shopee",
          category: null,
          availability: extracted.availability,
          shippingOrigin: "brazil",
          rating: extracted.rating ?? null,
          reviewCount: null,
        },
        discountPercent,
      );
      await offerRepository.insertOffer({
        id: offerId,
        productId: product.id,
        sourceObservationId: observation.id,
        status: "pending_approval",
        score,
        discountPercent,
        affiliateUrl: affiliate.url,
        affiliateProvider: "shopee",
        imageUrl: extracted.imageUrl,
        proposedCaption: caption,
        idempotencyKey: generateIdempotencyKey(
          "shopee",
          extracted.externalId,
          extracted.currentPriceCents,
          extracted.capturedAt,
        ),
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      });
      result.created += 1;
      result.offerIds.push(offerId);
      await requestApproval(offerId, logger);
      result.approvalRequested += 1;
    } catch (error) {
      result.failed += 1;
      logger.warn(
        {
          err: error,
          externalId: candidate.externalId,
          correlationId: input.correlationId,
        },
        "Shopee product processing failed",
      );
    }
  }
  logger.info({ ...result, offerIds: undefined }, "Shopee discovery completed");
  return result;
}
