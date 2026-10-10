import type { Logger } from "../config/logger.js";
import { discoveryEnv as env } from "../config/runtime.js";
import { db } from "../adapters/persistence/db.js";
import { offerRepository } from "../adapters/persistence/offer-repository.js";
import { priceObservationRepository } from "../adapters/persistence/price-observation-repository.js";
import { productRepository } from "../adapters/persistence/product-repository.js";
import { AwinAdapter } from "../adapters/sources/awin.adapter.js";
import {
  loadAwinFeed,
  selectFeedOffers,
  FEED_POOL_SIZE,
} from "../adapters/sources/awin-feed.js";
import { buildCaption } from "./create-manual-offer.js";
import { generateIdempotencyKey } from "./offer-helpers.js";
import { scoreOffer } from "./score.js";

interface AwinDiscoveryResult {
  status: "completed";
  source: "awin";
  discovered: number;
  enriched: number;
  created: number;
  approvalRequested: number;
  skipped: number;
  failed: number;
  offerIds: string[];
  skippedReasons: Record<string, number>;
}

function recordSkip(result: AwinDiscoveryResult, reason: string): void {
  result.skipped += 1;
  result.skippedReasons[reason] = (result.skippedReasons[reason] ?? 0) + 1;
}

function localDate(value: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: env.TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

async function getOrCreateAwinSource(): Promise<string> {
  const rows = await db.query<{ id: string }>(
    `INSERT INTO sources (slug, name, store, type, adapter_version, enabled)
     VALUES ('awin', 'Awin', 'Awin', 'api', '1.0.0', TRUE)
     ON CONFLICT (slug) DO UPDATE SET
       name = EXCLUDED.name,
       store = EXCLUDED.store,
       enabled = TRUE,
       updated_at = NOW()
     RETURNING id`,
  );
  return rows[0].id;
}

export async function runAwinDiscovery(
  input: {
    query?: string;
    category?: string;
    limit: number;
    correlationId?: string;
  },
  logger: Logger,
): Promise<AwinDiscoveryResult> {
  const adapter = new AwinAdapter();
  const health = await adapter.healthCheck();
  if (!health.healthy) throw new Error("Awin API is unavailable");

  const sourceId = await getOrCreateAwinSource();
  const feedProducts = await loadAwinFeed();
  const poolSize = Math.max(1, input.limit * FEED_POOL_SIZE);
  const candidates = selectFeedOffers(feedProducts, {
    query: input.query,
    poolSize,
  });

  const result: AwinDiscoveryResult = {
    status: "completed",
    source: "awin",
    discovered: feedProducts.length,
    enriched: candidates.length,
    created: 0,
    approvalRequested: 0,
    skipped: 0,
    failed: 0,
    offerIds: [],
    skippedReasons: {},
  };

  for (const product of candidates) {
    if (result.created >= input.limit) break;
    try {
      const duplicate = await offerRepository.findDuplicateBySourceAndExternal(
        "awin",
        product.externalId,
      );
      if (
        duplicate &&
        localDate(duplicate.createdAt) === localDate(new Date().toISOString())
      ) {
        recordSkip(result, "duplicate_today");
        continue;
      }

      const capturedAt = new Date().toISOString();
      const discountPercent = product.previousPriceCents
        ? ((product.previousPriceCents - product.currentPriceCents) /
            product.previousPriceCents) *
          100
        : null;

      const dbProduct = await productRepository.upsert({
        sourceId,
        externalId: product.externalId,
        canonicalUrl: product.productUrl,
        title: product.title,
        normalizedTitle: product.title.toLowerCase().trim(),
        brand: product.brand,
        category: input.category ?? product.category,
        currency: product.currency,
        imageUrl: product.imageUrl,
        availability: product.availability,
      });
      const observation = await priceObservationRepository.insert({
        productId: dbProduct.id,
        currentPriceCents: product.currentPriceCents,
        previousPriceCents: product.previousPriceCents ?? null,
        currency: product.currency,
        availability: product.availability,
        capturedAt,
      });

      const offerId = crypto.randomUUID();
      await offerRepository.insertOffer({
        id: offerId,
        productId: dbProduct.id,
        sourceObservationId: observation.id,
        status: "scheduled",
        score: scoreOffer({
          discountPercent,
          currentPriceCents: product.currentPriceCents,
          previousPriceCents: product.previousPriceCents ?? null,
          sourceReliability: 15,
          availability: product.availability,
          rating: null,
          reviewCount: null,
          nicheMatch: 5,
          hasPreviousPriceEvidence: !!product.previousPriceCents,
          titleComplete: product.title.length >= 5,
          hasImage: true,
          isExperimental: false,
        }),
        discountPercent,
        affiliateUrl: product.affiliateUrl,
        affiliateProvider: "awin",
        imageUrl: product.imageUrl,
        proposedCaption: buildCaption(
          {
            title: product.title,
            canonicalUrl: product.productUrl,
            currentPriceCents: product.currentPriceCents,
            previousPriceCents: product.previousPriceCents ?? null,
            currency: product.currency,
            imageUrl: product.imageUrl,
            affiliateUrl: product.affiliateUrl,
            store: product.merchantName || "Awin",
            category: input.category ?? product.category,
            brand: product.brand,
            availability: product.availability,
            shippingOrigin: "brazil",
          },
          discountPercent,
        ),
        idempotencyKey: generateIdempotencyKey(
          "awin",
          product.externalId,
          product.currentPriceCents,
          capturedAt,
        ),
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      });
      result.created += 1;
      result.offerIds.push(offerId);
    } catch (error) {
      result.failed += 1;
      logger.warn(
        {
          err: error,
          externalId: product.externalId,
          correlationId: input.correlationId,
        },
        "Awin product processing failed",
      );
    }
  }

  logger.info({ ...result, offerIds: undefined }, "Awin discovery completed");
  return result;
}
