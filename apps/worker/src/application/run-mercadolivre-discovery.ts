import type { Logger } from "../config/logger.js";
import { env } from "../config/env.js";
import { db } from "../adapters/persistence/db.js";
import { productRepository } from "../adapters/persistence/product-repository.js";
import { priceObservationRepository } from "../adapters/persistence/price-observation-repository.js";
import { offerRepository } from "../adapters/persistence/offer-repository.js";
import { MercadoLivreAdapter } from "../adapters/sources/mercadolivre.adapter.js";
import { validateOffer } from "./validate-offer.js";
import { scoreOffer } from "./score.js";
import { generateIdempotencyKey } from "./offer-helpers.js";
import { buildCaption } from "./create-manual-offer.js";

export interface MercadoLivreDiscoveryInput {
  query?: string;
  category?: string;
  limit: number;
  correlationId?: string;
}

export interface MercadoLivreDiscoveryResult {
  status: "completed";
  discovered: number;
  created: number;
  needsAffiliateLink: number;
  skipped: number;
  failed: number;
  offerIds: string[];
  skippedReasons: Record<string, number>;
}

function recordSkip(result: MercadoLivreDiscoveryResult, reason: string): void {
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

async function isImageReachable(imageUrl: string): Promise<boolean> {
  try {
    const response = await fetch(imageUrl, {
      headers: { Range: "bytes=0-1023" },
      signal: AbortSignal.timeout(5_000),
    });
    const contentType = response.headers.get("content-type") ?? "";
    if (response.body) await response.body.cancel();
    return response.ok && contentType.toLowerCase().startsWith("image/");
  } catch {
    return false;
  }
}

async function getOrCreateSource(): Promise<string> {
  const rows = await db.query<{ id: string }>(
    `INSERT INTO sources (slug, name, store, type, adapter_version, enabled)
     VALUES ('mercadolivre', 'Mercado Livre', 'Mercado Livre', 'api', '1.0.0', TRUE)
     ON CONFLICT (slug) DO UPDATE SET
       enabled = TRUE, adapter_version = EXCLUDED.adapter_version, updated_at = NOW()
     RETURNING id`,
  );
  return rows[0].id;
}

export async function runMercadoLivreDiscovery(
  input: MercadoLivreDiscoveryInput,
  logger: Logger,
): Promise<MercadoLivreDiscoveryResult> {
  const adapter = new MercadoLivreAdapter();
  const health = await adapter.healthCheck();
  if (!health.healthy) {
    throw new Error(
      String(
        health.details?.error ??
          health.details?.reason ??
          "Mercado Livre unavailable",
      ),
    );
  }
  const sourceId = await getOrCreateSource();
  const candidates = await adapter.discover({
    ...input,
    limit: input.limit * 5,
  });
  const result: MercadoLivreDiscoveryResult = {
    status: "completed",
    discovered: candidates.length,
    created: 0,
    needsAffiliateLink: 0,
    skipped: 0,
    failed: 0,
    offerIds: [],
    skippedReasons: {},
  };

  for (const candidate of candidates) {
    if (result.created >= input.limit) break;
    try {
      const duplicate = await offerRepository.findDuplicateBySourceAndExternal(
        "mercadolivre",
        candidate.externalId,
      );
      if (
        duplicate &&
        localDate(duplicate.createdAt) ===
          localDate(new Date().toISOString()) &&
        !["failed", "rejected", "expired"].includes(duplicate.status)
      ) {
        recordSkip(result, "duplicate_today");
        continue;
      }

      const extracted = await adapter.extract({
        url: new URL(candidate.canonicalUrl),
      });
      const validation = validateOffer(extracted);
      if (
        !validation.valid &&
        validation.reason !== "DISCOUNT_TOO_HIGH_REVIEW"
      ) {
        recordSkip(result, validation.reason ?? "validation_failed");
        continue;
      }
      if (
        !extracted.imageUrl ||
        !(await isImageReachable(extracted.imageUrl))
      ) {
        recordSkip(result, "image_unreachable");
        continue;
      }

      const discountPercent = validation.discountPercent ?? null;
      const score = scoreOffer({
        discountPercent,
        currentPriceCents: extracted.currentPriceCents,
        previousPriceCents: extracted.previousPriceCents ?? null,
        sourceReliability: 18,
        availability: extracted.availability,
        rating: null,
        reviewCount: null,
        nicheMatch: 5,
        hasPreviousPriceEvidence: !!extracted.previousPriceCents,
        titleComplete: extracted.title.length >= 5,
        hasImage: true,
        isExperimental: false,
      });
      const evidence = extracted.rawEvidence;
      const product = await productRepository.upsert({
        sourceId,
        externalId: extracted.externalId,
        canonicalUrl: extracted.canonicalUrl,
        title: extracted.title,
        normalizedTitle: extracted.title.toLowerCase().trim(),
        gtin: typeof evidence.gtin === "string" ? evidence.gtin : null,
        category: input.category ?? null,
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
        evidence,
        capturedAt: extracted.capturedAt,
      });
      const offerId = crypto.randomUUID();
      const caption = buildCaption(
        {
          title: extracted.title,
          canonicalUrl: extracted.canonicalUrl,
          currentPriceCents: extracted.currentPriceCents,
          previousPriceCents: extracted.previousPriceCents ?? null,
          currency: extracted.currency,
          imageUrl: extracted.imageUrl,
          store: extracted.seller ?? "Mercado Livre",
          category: input.category ?? null,
          availability: extracted.availability,
          shippingOrigin: "brazil",
          rating: extracted.rating ?? null,
          reviewCount: extracted.reviewCount ?? null,
          installmentCount:
            typeof evidence.installmentCount === "number"
              ? evidence.installmentCount
              : null,
          installmentValueCents:
            typeof evidence.installmentValueCents === "number"
              ? evidence.installmentValueCents
              : null,
          interestFree: evidence.interestFree === true,
        },
        discountPercent,
      );
      await offerRepository.insertOffer({
        id: offerId,
        productId: product.id,
        sourceObservationId: observation.id,
        status: "needs_affiliate_link",
        score,
        discountPercent,
        affiliateUrl: null,
        affiliateProvider: null,
        imageUrl: extracted.imageUrl,
        proposedCaption: caption,
        idempotencyKey: generateIdempotencyKey(
          "mercadolivre",
          extracted.externalId,
          extracted.currentPriceCents,
          extracted.capturedAt,
        ),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      });
      result.created += 1;
      result.needsAffiliateLink += 1;
      result.offerIds.push(offerId);
    } catch (error) {
      result.failed += 1;
      logger.warn(
        {
          err: error,
          externalId: candidate.externalId,
          correlationId: input.correlationId,
        },
        "Mercado Livre product processing failed",
      );
    }
  }
  logger.info(
    { ...result, offerIds: undefined },
    "Mercado Livre discovery completed",
  );
  return result;
}
