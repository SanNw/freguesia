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
import { offerEnv as env } from "../config/runtime.js";
import type { Logger } from "../config/logger.js";
import { AppError } from "../shared/errors.js";
import { buildOfferHeadline } from "../domain/offer-headline.js";
import {
  buildOfferCommerceDetails,
  type ShippingOrigin,
} from "../domain/offer-commerce-details.js";

export interface CreateManualOfferInput {
  title: string;
  canonicalUrl: string;
  currentPriceCents: number;
  previousPriceCents?: number | null;
  currency?: string;
  imageUrl?: string | null;
  additionalImages?: string[];
  couponCode?: string | null;
  couponDescription?: string | null;
  affiliateUrl?: string | null;
  store?: string;
  category?: string | null;
  brand?: string | null;
  availability?: string;
  shippingOrigin?: ShippingOrigin;
  rating?: number | null;
  reviewCount?: number | null;
  taxAmountCents?: number | null;
  taxIncluded?: boolean | null;
  taxConfirmed?: boolean;
  installmentCount?: number | null;
  installmentValueCents?: number | null;
  interestFree?: boolean;
}

export interface CreateManualOfferResult {
  offerId: string;
  status: string;
  score: number;
  discountPercent: number | null;
  rejectionReason?: string;
}

async function getOrCreateSource(store: string) {
  const rows = await db.query<{ id: string }>(
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
  return rows[0].id;
}

export function buildCaption(
  input: CreateManualOfferInput,
  discountPercent: number | null,
): string {
  const paragraphs: string[] = [
    `# ${buildOfferHeadline(input.title, input.category, discountPercent)}`,
    `**${input.title}**`,
  ];
  const priceLines: string[] = [];
  if (discountPercent && discountPercent > 0) {
    priceLines.push(`## \u{1F4A5} ${Math.round(discountPercent)}% DE DESCONTO`);
  }
  if (
    input.previousPriceCents &&
    input.previousPriceCents > input.currentPriceCents
  ) {
    const savings = input.previousPriceCents - input.currentPriceCents;
    priceLines.push(
      `~~De ${formatBRL(input.previousPriceCents)}~~\n# Por ${formatBRL(input.currentPriceCents)}\n\u{1F4B0} Você economiza **${formatBRL(savings)}**`,
    );
  } else {
    priceLines.push(`# ${formatBRL(input.currentPriceCents)}`);
  }
  paragraphs.push(priceLines.join("\n"));

  const commerceDetails = buildOfferCommerceDetails(input);
  if (commerceDetails.length > 0) {
    paragraphs.push(commerceDetails.join("\n"));
  }

  if (input.couponCode) {
    const couponLines = [
      "## \u{1F3AB} CUPOM",
      `Use o cupom: \`${input.couponCode}\``,
    ];
    if (input.couponDescription) couponLines.push(input.couponDescription);
    paragraphs.push(couponLines.join("\n"));
  }

  if (input.store) {
    paragraphs.push(`**Loja:** ${input.store}`);
  }

  return paragraphs.filter(Boolean).join("\n\n");
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
    rating: input.rating ?? null,
    reviewCount: input.reviewCount ?? null,
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
    rating: input.rating ?? null,
    reviewCount: input.reviewCount ?? null,
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

  const sourceId = await getOrCreateSource(store);

  return await db.withTransaction(async (client) => {
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
        affiliate_url, affiliate_provider, image_url, additional_image_urls,
        coupon_code, coupon_description, proposed_caption, idempotency_key, expires_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW() + INTERVAL '30 minutes')`,
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
        JSON.stringify(input.additionalImages ?? []),
        input.couponCode ?? null,
        input.couponDescription ?? null,
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
