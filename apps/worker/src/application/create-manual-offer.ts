import { db } from "../adapters/persistence/db.js";
import { productRepository } from "../adapters/persistence/product-repository.js";
import { priceObservationRepository } from "../adapters/persistence/price-observation-repository.js";
import { validateOffer } from "./validate-offer.js";
import { scoreOffer } from "./score.js";
import {
  generateExternalId,
  generateIdempotencyKey,
  isUrlValid,
} from "./offer-helpers.js";
import { formatBRL } from "../domain/price.js";
import { env } from "../config/env.js";
import type { Logger } from "../config/logger.js";
import { AppError } from "../shared/errors.js";

export interface CreateManualOfferInput {
  title: string;
  canonicalUrl: string;
  currentPriceCents: number;
  previousPriceCents?: number | null;
  currency?: string;
  imageUrl?: string | null;
  affiliateUrl?: string | null;
  store?: string;
  category?: string | null;
  brand?: string | null;
  availability?: string;
}

export interface CreateManualOfferResult {
  offerId: string;
  status: string;
  score: number;
  discountPercent: number | null;
  rejectionReason?: string;
}

async function getOrCreateSource(
  client: import("pg").PoolClient,
  store: string,
) {
  const rows = await client.query<{ id: string }>(
    `INSERT INTO sources (slug, name, store, type, adapter_version, enabled)
     VALUES ($1, $2, $3, 'manual', '0.1.0', TRUE)
     ON CONFLICT (slug) DO UPDATE SET updated_at = NOW()
     RETURNING id`,
    [
      `manual-${store.toLowerCase().replace(/\s+/g, "-")}`,
      `Manual - ${store}`,
      store,
    ],
  );
  return rows.rows[0].id;
}

function buildCaption(
  input: CreateManualOfferInput,
  discountPercent: number | null,
): string {
  const lines: string[] = [];
  lines.push("\u{1F525} OFERTA NA FREGUESIA");
  lines.push("");
  lines.push(input.title);
  lines.push("");
  if (
    input.previousPriceCents &&
    input.previousPriceCents > input.currentPriceCents
  ) {
    lines.push(
      `De ${formatBRL(input.previousPriceCents)} por ${formatBRL(input.currentPriceCents)}`,
    );
  } else {
    lines.push(`${formatBRL(input.currentPriceCents)}`);
  }
  if (discountPercent && discountPercent > 0) {
    lines.push(`${Math.round(discountPercent)}% de desconto`);
  }
  if (input.store) {
    lines.push(`Loja: ${input.store}`);
  }
  lines.push("");
  lines.push("\u{1F6CD}Comprar com desconto");
  lines.push("");
  lines.push(env.TELEGRAM_MESSAGE_FOOTER);
  if (env.AFFILIATE_DISCLOSURE_TEXT) {
    lines.push("");
    lines.push(env.AFFILIATE_DISCLOSURE_TEXT);
  }
  return lines.join("\n");
}

export async function createManualOffer(
  input: CreateManualOfferInput,
  logger: Logger,
): Promise<CreateManualOfferResult> {
  const currency = input.currency ?? env.DEFAULT_CURRENCY;
  const availability = input.availability ?? "in_stock";
  const store = input.store ?? "Manual";
  const now = new Date().toISOString();

  const extracted = {
    source: "manual",
    externalId: generateExternalId(input.canonicalUrl),
    canonicalUrl: input.canonicalUrl,
    title: input.title,
    currentPriceCents: input.currentPriceCents,
    previousPriceCents: input.previousPriceCents ?? null,
    currency,
    imageUrl: input.imageUrl ?? null,
    availability: availability as
      "in_stock" | "out_of_stock" | "preorder" | "unknown",
    seller: null,
    rating: null,
    reviewCount: null,
    capturedAt: now,
    rawEvidence: {},
  };

  const validation = validateOffer(extracted);
  let score = 0;
  let discountPercent: number | null = null;
  let status = "discovered";

  if (!validation.valid) {
    if (validation.reason === "DISCOUNT_TOO_HIGH_REVIEW") {
      status = "pending_approval";
      discountPercent = validation.discountPercent ?? null;
    } else {
      throw new AppError(
        "VALIDATION_FAILED",
        `Offer rejected: ${validation.reason}`,
        false,
        422,
      );
    }
  } else {
    score = validation.score ?? 0;
    discountPercent = validation.discountPercent ?? null;
    status = isUrlValid(input.affiliateUrl)
      ? "pending_approval"
      : "needs_affiliate_link";
  }

  score = scoreOffer({
    discountPercent,
    currentPriceCents: input.currentPriceCents,
    previousPriceCents: input.previousPriceCents ?? null,
    sourceReliability: 15,
    availability,
    rating: null,
    reviewCount: null,
    nicheMatch: 5,
    hasPreviousPriceEvidence: !!input.previousPriceCents,
    titleComplete: input.title.length >= 5,
    hasImage: !!input.imageUrl,
    isExperimental: false,
  });

  const idempotencyKey = generateIdempotencyKey(
    "manual",
    extracted.externalId,
    input.currentPriceCents,
    now,
  );

  const caption = buildCaption(input, discountPercent);

  return await db.withTransaction(async (client) => {
    const sourceId = await getOrCreateSource(client, store);

    const product = await productRepository.upsert({
      sourceId,
      externalId: extracted.externalId,
      canonicalUrl: input.canonicalUrl,
      title: input.title,
      normalizedTitle: input.title.toLowerCase().trim(),
      brand: input.brand ?? null,
      category: input.category ?? null,
      currency,
      imageUrl: input.imageUrl ?? null,
      availability,
    });

    const observation = await priceObservationRepository.insert({
      productId: product.id,
      currentPriceCents: input.currentPriceCents,
      previousPriceCents: input.previousPriceCents ?? null,
      currency,
      availability,
      capturedAt: now,
    });

    const offerId = crypto.randomUUID();
    await client.query(
      `INSERT INTO offers (
        id, product_id, source_observation_id, status, score, discount_percent,
        affiliate_url, affiliate_provider, image_url, proposed_caption, idempotency_key, expires_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW() + INTERVAL '30 minutes')`,
      [
        offerId,
        product.id,
        observation.id,
        status,
        score,
        discountPercent,
        input.affiliateUrl ?? null,
        input.affiliateUrl ? "manual" : null,
        input.imageUrl ?? null,
        caption,
        idempotencyKey,
      ],
    );

    logger.info(
      { offerId, product: product.id, score, status },
      "Manual offer created",
    );

    return { offerId, status, score, discountPercent };
  });
}
