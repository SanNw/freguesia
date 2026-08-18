import type { Logger } from "../config/logger.js";
import { env } from "../config/env.js";
import { db } from "../adapters/persistence/db.js";
import { productRepository } from "../adapters/persistence/product-repository.js";
import { priceObservationRepository } from "../adapters/persistence/price-observation-repository.js";
import { offerRepository } from "../adapters/persistence/offer-repository.js";
import { AliExpressAdapter } from "../adapters/sources/aliexpress.adapter.js";
import { validateOffer } from "./validate-offer.js";
import { scoreOffer } from "./score.js";
import { generateIdempotencyKey } from "./offer-helpers.js";
import { buildCaption } from "./create-manual-offer.js";
import { requestApproval } from "./request-approval.js";

export interface AliExpressDiscoveryInput {
  query?: string;
  category?: string;
  limit: number;
  correlationId?: string;
}

async function sourceId(): Promise<string> {
  const rows = await db.query<{ id: string }>(
    `INSERT INTO sources (slug, name, store, type, adapter_version, enabled)
     VALUES ('aliexpress', 'AliExpress', 'AliExpress', 'api', '1.0.0', TRUE)
     ON CONFLICT (slug) DO UPDATE SET enabled = TRUE, adapter_version = EXCLUDED.adapter_version, updated_at = NOW()
     RETURNING id`,
  );
  return rows[0].id;
}

function evidenceString(
  evidence: Record<string, unknown>,
  key: string,
): string | null {
  const value = evidence[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function evidenceNumber(
  evidence: Record<string, unknown>,
  key: string,
): number | null {
  const value = Number(evidence[key]);
  return Number.isFinite(value) ? value : null;
}

function localDate(value: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: env.TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
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

export async function runAliExpressDiscovery(
  input: AliExpressDiscoveryInput,
  logger: Logger,
) {
  const adapter = new AliExpressAdapter();
  const health = await adapter.healthCheck();
  if (!health.healthy)
    throw new Error(String(health.details?.reason ?? "AliExpress unavailable"));

  const candidates = await adapter.discover({
    ...input,
    limit: input.limit * 5,
  });
  const aliSourceId = await sourceId();
  const result = {
    status: "completed" as const,
    source: "aliexpress",
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
      const duplicate = await offerRepository.findDuplicateBySourceAndExternal(
        "aliexpress",
        candidate.externalId,
      );
      if (
        duplicate &&
        localDate(duplicate.createdAt) ===
          localDate(new Date().toISOString()) &&
        !["failed", "rejected", "expired"].includes(duplicate.status)
      ) {
        skip("duplicate_today");
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

      const evidence = extracted.rawEvidence;
      const additionalImages = Array.isArray(evidence.additionalImageUrls)
        ? evidence.additionalImageUrls.filter(
            (value): value is string => typeof value === "string",
          )
        : [];
      const videoUrls = Array.isArray(evidence.videoUrls)
        ? evidence.videoUrls.filter(
            (value): value is string => typeof value === "string",
          )
        : [];
      const additionalMedia = [
        ...new Set([...additionalImages, ...videoUrls]),
      ].slice(0, 9);
      const shippingOrigin =
        evidenceString(evidence, "shippingOrigin") === "brazil"
          ? "brazil"
          : "international";
      const discountPercent = validation.discountPercent ?? null;
      const score = scoreOffer({
        discountPercent,
        currentPriceCents: extracted.currentPriceCents,
        previousPriceCents: extracted.previousPriceCents ?? null,
        sourceReliability: 15,
        availability: extracted.availability,
        rating: extracted.rating ?? null,
        reviewCount: extracted.reviewCount ?? null,
        nicheMatch: shippingOrigin === "brazil" ? 10 : 5,
        hasPreviousPriceEvidence: !!extracted.previousPriceCents,
        titleComplete: extracted.title.length >= 5,
        hasImage: true,
        isExperimental: false,
      });
      const product = await productRepository.upsert({
        sourceId: aliSourceId,
        externalId: extracted.externalId,
        canonicalUrl: extracted.canonicalUrl,
        title: extracted.title,
        normalizedTitle: extracted.title.toLowerCase().trim(),
        brand: null,
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
          additionalImages: additionalMedia,
          affiliateUrl: affiliate.url,
          store: "AliExpress",
          category: input.category ?? null,
          availability: extracted.availability,
          shippingOrigin,
          rating: extracted.rating ?? null,
          reviewCount: extracted.reviewCount ?? null,
          couponCode: evidenceString(evidence, "couponCode"),
          couponDescription: evidenceString(evidence, "couponDescription"),
          taxAmountCents: evidenceNumber(evidence, "taxAmountCents"),
          taxIncluded: evidence.taxIncluded === true,
          taxConfirmed: evidence.taxConfirmed === true,
          installmentCount: evidenceNumber(evidence, "installmentCount"),
          installmentValueCents: evidenceNumber(
            evidence,
            "installmentValueCents",
          ),
          interestFree: evidence.interestFree === true,
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
        affiliateProvider: "aliexpress",
        imageUrl: extracted.imageUrl,
        additionalImageUrls: additionalMedia,
        couponCode: evidenceString(evidence, "couponCode"),
        couponDescription: evidenceString(evidence, "couponDescription"),
        proposedCaption: caption,
        idempotencyKey: generateIdempotencyKey(
          "aliexpress",
          extracted.externalId,
          extracted.currentPriceCents,
          extracted.capturedAt,
        ),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
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
        "AliExpress product processing failed",
      );
    }
  }
  logger.info(
    { ...result, offerIds: undefined },
    "AliExpress discovery completed",
  );
  return result;
}
