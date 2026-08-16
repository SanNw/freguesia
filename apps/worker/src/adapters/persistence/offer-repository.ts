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
    proposedCaption: string | null;
    idempotencyKey: string;
    expiresAt: string | null;
  }): Promise<void> {
    await db.query(
      `INSERT INTO offers (id, product_id, source_observation_id, status, score, discount_percent,
        affiliate_url, affiliate_provider, image_url, proposed_caption, idempotency_key, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
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
        offer.proposedCaption,
        offer.idempotencyKey,
        offer.expiresAt,
      ],
    );
  }

  async getOffer(id: string): Promise<Offer | null> {
    const rows = await db.query(
      `SELECT id, product_id, source_observation_id, status, score, discount_percent,
        affiliate_url, affiliate_provider, image_url, proposed_caption,
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
        affiliate_url, affiliate_provider, image_url, proposed_caption,
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
    const rows = await db.query(
      `SELECT id, product_id, source_observation_id, status, score, discount_percent,
        affiliate_url, affiliate_provider, image_url, proposed_caption,
        rejection_reason, expires_at, idempotency_key, created_at, updated_at
       FROM offers WHERE LEFT(id::text, ${shortId.length}) = $1`,
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

  async findDuplicateBySourceAndExternal(
    source: string,
    externalId: string,
  ): Promise<Offer | null> {
    const rows = await db.query(
      `SELECT o.id, o.product_id, o.source_observation_id, o.status, o.score,
         o.discount_percent, o.affiliate_url, o.affiliate_provider,
         o.image_url, o.proposed_caption, o.rejection_reason, o.expires_at,
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

  async findRecentPublishedOffer(
    productId: string,
    repostCooldownHours: number,
    minPriceDropPercent: number,
  ): Promise<Offer | null> {
    const rows = await db.query(
      `SELECT o.id, o.product_id, o.source_observation_id, o.status, o.score,
         o.discount_percent, o.affiliate_url, o.affiliate_provider,
         o.image_url, o.proposed_caption, o.rejection_reason, o.expires_at,
         o.idempotency_key, o.created_at, o.updated_at,
         po.current_price_cents
        FROM offers o
        JOIN publications pub ON pub.offer_id = o.id
        JOIN price_observations po ON po.id = o.source_observation_id
        WHERE o.product_id = $1
          AND o.status = 'published'
          AND pub.published_at >= NOW() - INTERVAL '${repostCooldownHours} hours'
        ORDER BY pub.published_at DESC
        LIMIT 1`,
      [productId],
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
      const latestPriceCents = Number(latestObs[0].currentPriceCents);
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
        row.discount_percent !== null ? Number(row.discount_percent) : null,
      affiliateUrl:
        row.affiliate_url !== null ? String(row.affiliate_url) : null,
      affiliateProvider:
        row.affiliate_provider !== null ? String(row.affiliate_provider) : null,
      imageUrl: row.image_url !== null ? String(row.image_url) : null,
      proposedCaption:
        row.proposed_caption !== null ? String(row.proposed_caption) : null,
      rejectionReason:
        row.rejection_reason !== null ? String(row.rejection_reason) : null,
      expiresAt: row.expires_at !== null ? String(row.expires_at) : null,
      idempotencyKey: String(row.idempotency_key),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }
}

export const offerRepository = new OfferRepository();
