import { db } from "./db.js";
import { calculatePriceDropPercent } from "../../domain/price.js";
import type { Offer } from "../../domain/offer.js";

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
        rejection_reason, expires_at, idempotency_key, created_at, updated_at
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
        rejection_reason, expires_at, idempotency_key, created_at, updated_at
       FROM offers`;
    const params: unknown[] = [];
    if (status) {
      query += ` WHERE status = $1`;
      params.push(status);
    }
    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);
    const rows = await db.query(query, params);
    return rows.map((r) => this.mapRow(r));
  }

  async getByIdShort(shortId: string): Promise<Offer | null> {
    if (!/^[0-9a-f]{8}$/i.test(shortId)) return null;
    const rows = await db.query(
      `SELECT id, product_id, source_observation_id, status, score, discount_percent,
        affiliate_url, affiliate_provider, image_url, additional_image_urls,
        coupon_code, coupon_description, proposed_caption,
        rejection_reason, expires_at, idempotency_key, created_at, updated_at
       FROM offers WHERE id::text LIKE $1 || '%' 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [shortId],
    );
    if (rows.length === 0) return null;
    return this.mapRow(rows[0]);
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
  ): Promise<void> {
    await db.query(
      `UPDATE offers SET
        affiliate_url = $1,
        affiliate_provider = 'mercadolivre-manual',
        proposed_caption = $2,
        status = 'pending_approval',
        expires_at = NOW() + INTERVAL '2 hours',
        updated_at = NOW()
       WHERE id = $3 AND status = 'needs_affiliate_link'`,
      [url, caption, id],
    );
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
         o.coupon_description, o.proposed_caption, o.rejection_reason, o.expires_at,
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
         o.coupon_description, o.proposed_caption, o.rejection_reason, o.expires_at,
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
