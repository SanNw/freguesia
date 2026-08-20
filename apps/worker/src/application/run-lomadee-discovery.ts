import type { Logger } from "../config/logger.js";
import { discoveryEnv as env } from "../config/runtime.js";
import { db } from "../adapters/persistence/db.js";
import { productRepository } from "../adapters/persistence/product-repository.js";
import { priceObservationRepository } from "../adapters/persistence/price-observation-repository.js";
import { offerRepository } from "../adapters/persistence/offer-repository.js";
import { LomadeeAdapter } from "../adapters/sources/lomadee.adapter.js";
import { validateOffer } from "./validate-offer.js";
import { scoreOffer } from "./score.js";
import { generateIdempotencyKey } from "./offer-helpers.js";
import { buildCaption } from "./create-manual-offer.js";
import { requestApproval } from "./request-approval.js";

export interface LomadeeDiscoveryInput {
  query?: string;
  category?: string;
  limit: number;
  correlationId?: string;
}

export interface LomadeeDiscoveryResult {
  status: "completed";
  discovered: number;
  created: number;
  approvalRequested: number;
  skipped: number;
  failed: number;
  offerIds: string[];
  skippedReasons: Record<string, number>;
}

function recordSkip(result: LomadeeDiscoveryResult, reason: string): void {
  result.skipped += 1;
  result.skippedReasons[reason] = (result.skippedReasons[reason] ?? 0) + 1;
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

function localDate(value: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: env.TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

async function getOrCreateLomadeeSource(): Promise<string> {
  const rows = await db.query<{ id: string }>(
    `INSERT INTO sources (slug, name, store, type, adapter_version, enabled)
     VALUES ('lomadee', 'Lomadee', 'Lomadee', 'api', '2.0.0', TRUE)
     ON CONFLICT (slug) DO UPDATE SET
       enabled = TRUE,
       adapter_version = EXCLUDED.adapter_version,
       updated_at = NOW()
     RETURNING id`,
  );
  return rows[0].id;
}

function evidenceString(
  evidence: Record<string, unknown>,
  key: string,
): string | null {
  const value = evidence[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function evidenceNumber(
  evidence: Record<string, unknown>,
  key: string,
): number {
  const value = Number(evidence[key]);
  return Number.isFinite(value) ? value : 0;
}

export async function runLomadeeDiscovery(
  input: LomadeeDiscoveryInput,
  logger: Logger,
): Promise<LomadeeDiscoveryResult> {
  const adapter = new LomadeeAdapter();
  const health = await adapter.healthCheck();
  if (!health.healthy) {
    throw new Error("Lomadee API or configured channel is unavailable");
  }

  const sourceId = await getOrCreateLomadeeSource();
  const discovered = await adapter.discover(input);
  const result: LomadeeDiscoveryResult = {
    status: "completed",
    discovered: discovered.length,
    created: 0,
    approvalRequested: 0,
    skipped: 0,
    failed: 0,
    offerIds: [],
    skippedReasons: {},
  };

  for (const candidate of discovered) {
    if (result.created >= input.limit) break;
    try {
      const duplicate = await offerRepository.findDuplicateBySourceAndExternal(
        "lomadee",
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

      const affiliate = await adapter.createAffiliateLink?.(
        new URL(extracted.canonicalUrl),
      );
      if (!affiliate || affiliate.status !== "generated") {
        recordSkip(result, "affiliate_link_failed");
        continue;
      }
      if (
        !extracted.imageUrl ||
        !(await isImageReachable(extracted.imageUrl))
      ) {
        recordSkip(result, "image_unreachable");
        continue;
      }

      const evidence = extracted.rawEvidence;
      const additionalImages = Array.isArray(evidence.additionalImageUrls)
        ? evidence.additionalImageUrls.filter(
            (value): value is string => typeof value === "string",
          )
        : [];
      const couponCode = evidenceString(evidence, "couponCode");
      const couponDescription = evidenceString(evidence, "couponDescription");
      const discountPercent = validation.discountPercent ?? null;
      const score = scoreOffer({
        discountPercent,
        currentPriceCents: extracted.currentPriceCents,
        previousPriceCents: extracted.previousPriceCents ?? null,
        sourceReliability: 15,
        availability: extracted.availability,
        rating: extracted.rating ?? null,
        reviewCount: extracted.reviewCount ?? null,
        nicheMatch: Math.min(
          10,
          Math.log10(evidenceNumber(evidence, "likes") + 1) * 2 +
            (evidence.highlightedCampaign === true ? 3 : 0),
        ),
        hasPreviousPriceEvidence: !!extracted.previousPriceCents,
        titleComplete: extracted.title.length >= 5,
        hasImage: !!extracted.imageUrl,
        isExperimental: false,
      });

      const product = await productRepository.upsert({
        sourceId,
        externalId: extracted.externalId,
        canonicalUrl: extracted.canonicalUrl,
        title: extracted.title,
        normalizedTitle: extracted.title.toLowerCase().trim(),
        brand: null,
        gtin: evidenceString(evidence, "ean"),
        category: input.category ?? null,
        currency: extracted.currency,
        imageUrl: extracted.imageUrl ?? null,
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
          additionalImages,
          couponCode,
          couponDescription,
          affiliateUrl: affiliate.url,
          store: extracted.seller ?? "Lomadee",
          category: input.category ?? null,
          availability: extracted.availability,
          shippingOrigin: "unknown",
          rating: extracted.rating ?? null,
          reviewCount: extracted.reviewCount ?? null,
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
        affiliateProvider: "lomadee",
        imageUrl: extracted.imageUrl ?? null,
        additionalImageUrls: additionalImages,
        couponCode,
        couponDescription,
        proposedCaption: caption,
        idempotencyKey: generateIdempotencyKey(
          "lomadee",
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
        "Lomadee product processing failed",
      );
    }
  }

  logger.info(
    { ...result, offerIds: undefined },
    "Lomadee discovery completed",
  );
  return result;
}
