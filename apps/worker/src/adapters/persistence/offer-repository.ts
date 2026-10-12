import { db } from "./db.js";
import { calculatePriceDropPercent } from "../../domain/price.js";
import type { Offer } from "../../domain/offer.js";
import {
  classifyProductNicheDecision,
  type ProductNiche,
} from "../../domain/product-niche.js";
import { selectPublicationCandidate } from "../../domain/publication-variety.js";
import {
  normalizeProductTitle,
  validatedGtin,
} from "../../domain/product-identity.js";

export class OfferRepository {
  async insertOffer(offer: {
    id: string;
    productId: string;
    sourceObservationId: string;
    status: string;
    score: number;
    discountPercent: number | null;
    affiliateUrl: string | null;
    affiliateProvider: string | null;
    imageUrl: string | null;
    additionalImageUrls?: string[];
    couponCode?: string | null;
    couponDescription?: string | null;
    proposedCaption: string | null;
    idempotencyKey: string;
    expiresAt: string | null;
  }): Promise<void> {
    await db.query(
      `INSERT INTO offers (id, product_id, source_observation_id, status, score, discount_percent,
        affiliate_url, affiliate_provider, image_url, additional_image_urls,
        coupon_code, coupon_description, proposed_caption, idempotency_key, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        offer.id,
        offer.productId,
        offer.sourceObservationId,
        offer.status,
        offer.score,
        offer.discountPercent,
        offer.affiliateUrl,
        offer.affiliateProvider,
        offer.imageUrl,
        JSON.stringify(offer.additionalImageUrls ?? []),
        offer.couponCode ?? null,
        offer.couponDescription ?? null,
        offer.proposedCaption,
        offer.idempotencyKey,
        offer.expiresAt,
      ],
    );
  }

  async getOffer(id: string): Promise<Offer | null> {
    const rows = await db.query(
      `SELECT id, product_id, source_observation_id, status, score, discount_percent,
        affiliate_url, affiliate_provider, image_url, additional_image_urls,
        coupon_code, coupon_description, proposed_caption,
        publication_niche, publication_niche_source, rejection_reason,
        expires_at, idempotency_key, created_at, updated_at
       FROM offers WHERE id = $1`,
      [id],
    );
    if (rows.length === 0) return null;
    return this.mapRow(rows[0]);
  }

  async updateStatus(
    id: string,
    status: string,
    reason?: string,
  ): Promise<void> {
    await db.query(
      `UPDATE offers SET status = $1, rejection_reason = $2, updated_at = NOW() WHERE id = $3`,
      [status, reason ?? null, id],
    );
  }

  async listOffers(
    status?: string,
    limit: number = 25,
    offset: number = 0,
  ): Promise<Offer[]> {
    let query = `SELECT id, product_id, source_observation_id, status, score, discount_percent,
        affiliate_url, affiliate_provider, image_url, additional_image_urls,
        coupon_code, coupon_description, proposed_caption,
        publication_niche, publication_niche_source, rejection_reason,
        expires_at, idempotency_key, created_at, updated_at
       FROM offers`;
    const params: unknown[] = [];
    if (status) {
      query += ` WHERE status = $1`;
      params.push(status);
    }
    if (status === "needs_affiliate_link") {
      query += ` AND (expires_at IS NULL OR expires_at > NOW())
        ORDER BY expires_at ASC NULLS LAST, created_at ASC`;
    } else {
      query += ` ORDER BY created_at DESC`;
    }
    query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);
    const rows = await db.query(query, params);
    return rows.map((r) => this.mapRow(r));
  }

  async getByIdShort(shortId: string): Promise<Offer | null> {
    const isFullId =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        shortId,
      );
    if (!isFullId && !/^[0-9a-f]{8}$/i.test(shortId)) return null;
    const rows = await db.query(
      `SELECT id, product_id, source_observation_id, status, score, discount_percent,
        affiliate_url, affiliate_provider, image_url, additional_image_urls,
        coupon_code, coupon_description, proposed_caption,
        publication_niche, publication_niche_source, rejection_reason,
        expires_at, idempotency_key, created_at, updated_at
       FROM offers WHERE ${isFullId ? "id = $1" : "id::text LIKE $1 || '%'"}
       ORDER BY created_at DESC 
       LIMIT 2`,
      [shortId],
    );
    if (rows.length !== 1) return null;
    return this.mapRow(rows[0]);
  }

  async transitionStatus(
    id: string,
    from: string[],
    to: string,
    rejectionReason?: string | null,
  ): Promise<boolean> {
    const rows = await db.query<{ id: string }>(
      `UPDATE offers
       SET status = $1, rejection_reason = $2, updated_at = NOW()
       WHERE id = $3 AND status = ANY($4::text[])
       RETURNING id`,
      [to, rejectionReason ?? null, id, from],
    );
    return rows.length === 1;
  }

  async updatePendingCaption(id: string, caption: string): Promise<boolean> {
    const rows = await db.query<{ id: string }>(
      `UPDATE offers SET proposed_caption = $1, updated_at = NOW()
       WHERE id = $2 AND status = 'pending_approval'
       RETURNING id`,
      [caption, id],
    );
    return rows.length === 1;
  }

  async expireScheduledOffers(): Promise<number> {
    const rows = await db.query<{ id: string }>(
      `UPDATE offers
       SET status = 'expired', rejection_reason = 'Offer expired before publication', updated_at = NOW()
       WHERE status IN ('scheduled', 'approved', 'needs_affiliate_link')
         AND expires_at IS NOT NULL AND expires_at <= NOW()
       RETURNING id`,
    );
    return rows.length;
  }

  async setPublicationNiche(
    id: string,
    niche: ProductNiche,
    source: "classifier" | "manual",
    fromStatuses: string[],
  ): Promise<boolean> {
    const rows = await db.query<{ id: string }>(
      `UPDATE offers
       SET publication_niche = $1,
           publication_niche_source = $2,
           status = $3,
           rejection_reason = NULL,
           updated_at = NOW()
       WHERE id = $4 AND status = ANY($5::text[])
       RETURNING id`,
      [niche, source, "scheduled", id, fromStatuses],
    );
    return rows.length === 1;
  }

  async findManualNicheForProduct(
    productId: string,
  ): Promise<ProductNiche | null> {
    const identity = await db.query<{ gtin: string | null }>(
      `SELECT gtin FROM products WHERE id = $1`,
      [productId],
    );
    const gtin = validatedGtin(identity[0]?.gtin);
    const rows = await db.query<{ publication_niche: ProductNiche }>(
      `SELECT o.publication_niche FROM offers o
       JOIN products previous ON previous.id = o.product_id
       JOIN products current ON current.id = $1
       WHERE o.publication_niche_source = 'manual'
         AND o.publication_niche IS NOT NULL AND o.status <> 'rejected'
         AND ((previous.source_id = current.source_id AND previous.external_id = current.external_id)
           OR ($2::text IS NOT NULL AND previous.gtin ~ '^([0-9]{8}|[0-9]{12}|[0-9]{13}|[0-9]{14})$'
             AND LPAD(previous.gtin, 14, '0') = $2))
       ORDER BY o.updated_at DESC LIMIT 1`,
      [productId, gtin],
    );
    return rows[0]?.publication_niche ?? null;
  }

  async findNextScheduled(): Promise<Offer | null> {
    const rows = await db.query(
      `SELECT o.id, o.product_id, o.source_observation_id, o.status, o.score, o.discount_percent,
               o.affiliate_url, o.affiliate_provider, o.image_url, o.additional_image_urls,
               o.coupon_code, o.coupon_description, o.proposed_caption,
               o.publication_niche, o.publication_niche_source, o.rejection_reason,
               o.expires_at, o.idempotency_key, o.created_at, o.updated_at,
               p.title AS product_title, p.category AS product_category
              FROM offers o
              JOIN products p ON p.id = o.product_id
              WHERE o.status IN ('scheduled', 'approved')
                AND (o.expires_at IS NULL OR o.expires_at > NOW())
              ORDER BY o.created_at ASC
              LIMIT 100`,
      [],
    );
    if (!rows.length) return null;
    const history = await db.query<{
      niche: ProductNiche;
      last_published: string;
    }>(
      `SELECT o.publication_niche AS niche, MAX(p.published_at)::text AS last_published
           FROM publications p JOIN offers o ON o.id = p.offer_id
           WHERE p.status = 'published' AND o.publication_niche IS NOT NULL
           GROUP BY o.publication_niche`,
    );
    const selected = selectPublicationCandidate(
      rows.map((row) => ({
        id: String(row.id),
        niche:
          (row.publication_niche as ProductNiche | null) ??
          classifyProductNicheDecision(
            String(row.product_title),
            row.product_category as string | null,
          ).niche,
        score: Number(row.score),
        createdAt: new Date(row.created_at as string).toISOString(),
        row,
      })),
      Object.fromEntries(history.map((row) => [row.niche, row.last_published])),
    );
    return selected ? this.mapRow(selected.row) : null;
  }

  async wasRecentlyPublished(
    offerId: string,
    cooldownHours: number,
    minPriceDropPercent: number,
  ): Promise<boolean> {
    const identity = await db.query<{ title: string; gtin: string | null }>(
      `SELECT p.title, p.gtin FROM products p JOIN offers o ON o.product_id = p.id WHERE o.id = $1`,
      [offerId],
    );
    if (!identity.length) return false;
    const normalizedTitle = normalizeProductTitle(identity[0].title);
    const gtin = validatedGtin(identity[0].gtin);
    const rows = await db.query<{
      current_price_cents: number;
      previous_price_cents: number;
    }>(
      `SELECT current_price.current_price_cents AS current_price_cents,
              previous_price.current_price_cents AS previous_price_cents
       FROM offers current_offer
       JOIN products current_product ON current_product.id = current_offer.product_id
       JOIN price_observations current_price ON current_price.id = current_offer.source_observation_id
       JOIN products previous_product ON
         (previous_product.source_id = current_product.source_id AND previous_product.external_id = current_product.external_id)
         OR (previous_product.normalized_title = $3 AND $3 <> '')
         OR ($3 <> '' AND TRIM(REGEXP_REPLACE(
           TRANSLATE(LOWER(previous_product.title), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'),
           '[^a-z0-9]+', ' ', 'g')) = $3)
         OR ($4::text IS NOT NULL AND previous_product.gtin ~ '^([0-9]{8}|[0-9]{12}|[0-9]{13}|[0-9]{14})$'
             AND LPAD(previous_product.gtin, 14, '0') = $4)
       JOIN offers previous_offer ON previous_offer.product_id = previous_product.id
       JOIN price_observations previous_price ON previous_price.id = previous_offer.source_observation_id
       JOIN publications publication ON publication.offer_id = previous_offer.id
       WHERE current_offer.id = $1
         AND previous_offer.id <> current_offer.id
         AND publication.status = 'published'
         AND publication.published_at >= NOW() - ($2 * INTERVAL '1 hour')
       ORDER BY publication.published_at DESC
       LIMIT 1`,
      [offerId, cooldownHours, normalizedTitle, gtin],
    );
    return (
      rows.length > 0 &&
      calculatePriceDropPercent(
        Number(rows[0].previous_price_cents),
        Number(rows[0].current_price_cents),
      ) < minPriceDropPercent
    );
  }

  async claimApproval(id: string, from: string): Promise<boolean> {
    const rows = await db.query<{ id: string }>(
      `UPDATE offers o
       SET status = 'approval_sending', updated_at = NOW()
       WHERE o.id = $1 AND o.status = $2
         AND NOT EXISTS (
           SELECT 1 FROM workflow_events e
           WHERE e.entity_type = 'offer' AND e.entity_id = o.id::text
             AND e.event_type = 'offer.pending_approval'
         )
       RETURNING o.id`,
      [id, from],
    );
    return rows.length === 1;
  }

  async updateAffiliateUrl(
    id: string,
    url: string,
    provider: string,
  ): Promise<void> {
    await db.query(
      `UPDATE offers SET affiliate_url = $1, affiliate_provider = $2, updated_at = NOW() WHERE id = $3`,
      [url, provider, id],
    );
  }

  async getAffiliateCompletionData(
    id: string,
  ): Promise<Record<string, unknown> | null> {
    const rows = await db.query<Record<string, unknown>>(
      `SELECT o.id, o.status, o.discount_percent, o.image_url,
        o.additional_image_urls, o.coupon_code, o.coupon_description,
        p.title, p.canonical_url, p.currency, p.availability,
        s.store, po.current_price_cents, po.previous_price_cents
       FROM offers o
       JOIN products p ON p.id = o.product_id
       JOIN sources s ON s.id = p.source_id
       JOIN price_observations po ON po.id = o.source_observation_id
       WHERE o.id = $1`,
      [id],
    );
    return rows[0] ?? null;
  }

  async completeAffiliateLink(
    id: string,
    url: string,
    caption: string,
  ): Promise<boolean> {
    const rows = await db.query<{ id: string }>(
      `UPDATE offers SET
        affiliate_url = $1,
        affiliate_provider = 'mercadolivre-manual',
        proposed_caption = $2,
        status = 'scheduled',
        expires_at = NOW() + INTERVAL '2 hours',
        updated_at = NOW()
       WHERE id = $3 AND status = 'needs_affiliate_link'
         AND (expires_at IS NULL OR expires_at > NOW())
       RETURNING id`,
      [url, caption, id],
    );
    return rows.length === 1;
  }

  async isBestPromotionForProduct(offerId: string): Promise<boolean> {
    const rows = await db.query<{ id: string }>(
      `SELECT o.id
       FROM offers o
       JOIN price_observations po ON po.id = o.source_observation_id
       WHERE o.product_id = (SELECT product_id FROM offers WHERE id = $1)
         AND o.status IN ('pending_approval', 'approved', 'scheduled')
         AND o.affiliate_url IS NOT NULL
         AND o.image_url IS NOT NULL
         AND (o.expires_at IS NULL OR o.expires_at > NOW())
       ORDER BY
         o.discount_percent DESC NULLS LAST,
         po.current_price_cents ASC,
         o.score DESC,
         o.created_at DESC
       LIMIT 1`,
      [offerId],
    );
    return rows[0]?.id === offerId;
  }

  async findDuplicateBySourceAndExternal(
    source: string,
    externalId: string,
  ): Promise<Offer | null> {
    const rows = await db.query(
      `SELECT o.id, o.product_id, o.source_observation_id, o.status, o.score,
         o.discount_percent, o.affiliate_url, o.affiliate_provider,
         o.image_url, o.additional_image_urls, o.coupon_code,
         o.coupon_description, o.proposed_caption, o.publication_niche,
         o.publication_niche_source, o.rejection_reason, o.expires_at,
         o.idempotency_key, o.created_at, o.updated_at
        FROM offers o
        JOIN products p ON p.id = o.product_id
        JOIN sources s ON s.id = p.source_id
        WHERE s.slug = $1 AND p.external_id = $2
        ORDER BY o.created_at DESC
        LIMIT 1`,
      [source, externalId],
    );
    if (rows.length === 0) return null;
    return this.mapRow(rows[0]);
  }

  async findLastSeenPriceBySourceAndExternal(
    source: string,
    externalId: string,
  ): Promise<number | null> {
    const rows = await db.query<{ current_price_cents: string | number }>(
      `SELECT po.current_price_cents
       FROM offers o
       JOIN products p ON p.id = o.product_id
       JOIN sources s ON s.id = p.source_id
       JOIN price_observations po ON po.id = o.source_observation_id
       WHERE s.slug = $1 AND p.external_id = $2
       ORDER BY o.created_at DESC
       LIMIT 1`,
      [source, externalId],
    );
    return rows[0] ? Number(rows[0].current_price_cents) : null;
  }

  async findRecentPublishedOffer(
    productId: string,
    repostCooldownHours: number,
    minPriceDropPercent: number,
  ): Promise<Offer | null> {
    const rows = await db.query(
      `SELECT o.id, o.product_id, o.source_observation_id, o.status, o.score,
         o.discount_percent, o.affiliate_url, o.affiliate_provider,
         o.image_url, o.additional_image_urls, o.coupon_code,
         o.coupon_description, o.proposed_caption, o.publication_niche,
         o.publication_niche_source, o.rejection_reason, o.expires_at,
         o.idempotency_key, o.created_at, o.updated_at,
         po.current_price_cents
        FROM offers o
        JOIN publications pub ON pub.offer_id = o.id
        JOIN price_observations po ON po.id = o.source_observation_id
        WHERE o.product_id = $1
          AND o.status = 'published'
          AND pub.published_at >= NOW() - ($2 * INTERVAL '1 hour')
        ORDER BY pub.published_at DESC
        LIMIT 1`,
      [productId, repostCooldownHours],
    );
    if (rows.length === 0) return null;

    const offer = this.mapRow(rows[0]);
    const lastPublishedPriceCents = Number(rows[0].current_price_cents);
    const latestObs = await db.query(
      `SELECT current_price_cents FROM price_observations
       WHERE product_id = $1
       ORDER BY captured_at DESC
       LIMIT 1`,
      [productId],
    );
    if (latestObs.length > 0) {
      const latestPriceCents = Number(latestObs[0].current_price_cents);
      const previousPrice = lastPublishedPriceCents;
      const dropPercent = calculatePriceDropPercent(
        previousPrice,
        latestPriceCents,
      );
      if (dropPercent < minPriceDropPercent) {
        return offer;
      }
    }
    return null;
  }

  private mapRow(row: Record<string, unknown>): Offer {
    return {
      id: String(row.id),
      productId: String(row.product_id),
      sourceObservationId: String(row.source_observation_id),
      status: String(row.status) as Offer["status"],
      score: Number(row.score),
      discountPercent:
        row.discount_percent != null ? Number(row.discount_percent) : null,
      affiliateUrl:
        row.affiliate_url != null ? String(row.affiliate_url) : null,
      affiliateProvider:
        row.affiliate_provider != null ? String(row.affiliate_provider) : null,
      imageUrl: row.image_url != null ? String(row.image_url) : null,
      additionalImageUrls: Array.isArray(row.additional_image_urls)
        ? row.additional_image_urls.map(String)
        : [],
      couponCode: row.coupon_code != null ? String(row.coupon_code) : null,
      couponDescription:
        row.coupon_description != null ? String(row.coupon_description) : null,
      proposedCaption:
        row.proposed_caption != null ? String(row.proposed_caption) : null,
      publicationNiche:
        row.publication_niche != null
          ? (String(row.publication_niche) as ProductNiche)
          : null,
      publicationNicheSource:
        row.publication_niche_source != null
          ? (String(row.publication_niche_source) as "classifier" | "manual")
          : null,
      rejectionReason:
        row.rejection_reason != null ? String(row.rejection_reason) : null,
      expiresAt: row.expires_at != null ? String(row.expires_at) : null,
      idempotencyKey: String(row.idempotency_key),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }
}

export const offerRepository = new OfferRepository();
