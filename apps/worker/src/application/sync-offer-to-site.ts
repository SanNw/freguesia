import { createHash } from "node:crypto";
import type { Logger } from "../config/logger.js";
import { appEnv, siteEnv } from "../config/runtime.js";
import {
  siteSyncRepository,
  type SiteOfferRow,
} from "../adapters/persistence/site-sync-repository.js";
import { classifyProductNiche } from "../domain/product-niche.js";

export type { SiteOfferRow };

function iso(value: string | Date): string {
  return new Date(value).toISOString();
}

export function buildSiteOfferSlug(title: string, offerId: string): string {
  const titlePart = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 145)
    .replace(/-$/g, "");
  return `${titlePart || "oferta"}-${offerId.slice(0, 8)}`;
}

export function buildSiteOfferPayload(row: SiteOfferRow) {
  return {
    id: row.id,
    slug: buildSiteOfferSlug(row.title, row.id),
    title: row.title,
    store: row.store,
    category: classifyProductNiche(row.title, row.productCategory),
    currentPriceCents: Number(row.currentPriceCents),
    previousPriceCents:
      row.previousPriceCents === null ? null : Number(row.previousPriceCents),
    discountPercent:
      row.discountPercent === null
        ? null
        : Math.round(Number(row.discountPercent)),
    affiliateUrl: row.affiliateUrl,
    imageUrls: [
      ...new Set([row.imageUrl, ...row.additionalImageUrls].filter(Boolean)),
    ],
    expiresAt: row.expiresAt ? iso(row.expiresAt) : null,
    publishedAt: iso(row.publishedAt),
    updatedAt: iso(row.updatedAt),
    active: true,
  };
}

export function deriveSiteSyncToken(serviceToken: string): string {
  return createHash("sha256")
    .update(`cloudflare-site-sync:${serviceToken}`)
    .digest("hex");
}

export async function pushSiteOffer(
  row: SiteOfferRow,
  options: {
    baseUrl: string;
    serviceToken: string;
    timeoutMs: number;
    fetcher?: typeof fetch;
  },
): Promise<void> {
  const response = await (options.fetcher ?? fetch)(
    `${options.baseUrl.replace(/\/$/, "")}/api/internal/offers/${row.id}`,
    {
      method: "PUT",
      headers: {
        authorization: `Bearer ${deriveSiteSyncToken(options.serviceToken)}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(buildSiteOfferPayload(row)),
      signal: AbortSignal.timeout(options.timeoutMs),
    },
  );
  if (!response.ok) {
    throw new Error(`Site sync failed with HTTP ${response.status}`);
  }
}

async function push(row: SiteOfferRow): Promise<void> {
  await pushSiteOffer(row, {
    baseUrl: siteEnv.SITE_API_BASE_URL,
    serviceToken: appEnv.WORKER_SERVICE_TOKEN,
    timeoutMs: siteEnv.SITE_SYNC_TIMEOUT_MS,
  });
}

export async function syncOfferToSite(
  offerId: string,
  logger: Logger,
): Promise<void> {
  if (!siteEnv.SITE_SYNC_ENABLED) return;
  try {
    const row = await siteSyncRepository.findPublishedOffer(offerId);
    if (row) await push(row);
  } catch (error) {
    logger.warn(
      { err: error, offerId },
      "Site sync failed; Telegram publication preserved",
    );
  }
}

export async function syncPublishedOffersToSite(
  limit: number,
  logger: Logger,
): Promise<{ synced: number; failed: number }> {
  const rows = await siteSyncRepository.listPublishedOffers(limit);
  let synced = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      await push(row);
      synced += 1;
    } catch (error) {
      failed += 1;
      logger.warn(
        { err: error, offerId: row.id },
        "Published offer backfill failed",
      );
    }
  }
  return { synced, failed };
}
