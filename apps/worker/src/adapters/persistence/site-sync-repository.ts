import { db } from "./db.js";

export interface SiteOfferRow {
  [key: string]: unknown;
  id: string;
  title: string;
  store: string;
  productCategory: string | null;
  currentPriceCents: string | number;
  previousPriceCents: string | number | null;
  discountPercent: string | number | null;
  affiliateUrl: string;
  imageUrl: string | null;
  additionalImageUrls: string[];
  expiresAt: string | Date | null;
  publishedAt: string | Date;
  updatedAt: string | Date;
}

const SELECT_SITE_OFFER = `SELECT
  o.id,
  p.title,
  s.store,
  p.category AS "productCategory",
  po.current_price_cents AS "currentPriceCents",
  po.previous_price_cents AS "previousPriceCents",
  o.discount_percent AS "discountPercent",
  o.affiliate_url AS "affiliateUrl",
  o.image_url AS "imageUrl",
  o.additional_image_urls AS "additionalImageUrls",
  o.expires_at AS "expiresAt",
  pub.published_at AS "publishedAt",
  GREATEST(o.updated_at, p.updated_at, pub.published_at) AS "updatedAt"
FROM offers o
JOIN products p ON p.id = o.product_id
JOIN sources s ON s.id = p.source_id
JOIN price_observations po ON po.id = o.source_observation_id
JOIN publications pub ON pub.offer_id = o.id
WHERE o.status = 'published'
  AND pub.status = 'published'
  AND o.affiliate_url IS NOT NULL
  AND pub.published_at IS NOT NULL`;

export class SiteSyncRepository {
  async findPublishedOffer(offerId: string): Promise<SiteOfferRow | null> {
    const rows = await db.query<SiteOfferRow>(
      `${SELECT_SITE_OFFER} AND o.id = $1 LIMIT 1`,
      [offerId],
    );
    return rows[0] ?? null;
  }

  async listPublishedOffers(limit = 500): Promise<SiteOfferRow[]> {
    return db.query<SiteOfferRow>(
      `${SELECT_SITE_OFFER}
       AND (o.expires_at IS NULL OR o.expires_at > NOW())
       ORDER BY pub.published_at DESC
       LIMIT $1`,
      [limit],
    );
  }
}

export const siteSyncRepository = new SiteSyncRepository();
