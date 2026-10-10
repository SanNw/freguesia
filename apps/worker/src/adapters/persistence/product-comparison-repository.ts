import { db, type Database } from "./db.js";
import { normalizeComparisonText } from "../../domain/product-comparison.js";

export interface ComparisonOffer {
  offerId: string;
  title: string;
  priceCents: number;
  affiliateUrl: string;
  brand: string | null;
  model: string | null;
}
export interface ComparisonCatalog {
  search(query: string): Promise<ComparisonOffer[]>;
  publishedProduct(
    id: string,
  ): Promise<{ title: string; model: string | null } | null>;
}
export class ProductComparisonRepository implements ComparisonCatalog {
  constructor(private readonly database: Pick<Database, "query"> = db) {}
  async search(query: string): Promise<ComparisonOffer[]> {
    const tokens = normalizeComparisonText(query).split(" ").filter(Boolean);
    if (!tokens.length) return [];
    const rows = await this.database.query(
      `SELECT o.id AS offer_id, p.title, p.brand, p.model,
      po.current_price_cents, o.affiliate_url FROM offers o
      JOIN products p ON p.id = o.product_id
      JOIN price_observations po ON po.id = o.source_observation_id
      WHERE o.status IN ('approved', 'scheduled', 'published')
      AND (o.expires_at IS NULL OR o.expires_at > NOW())
      AND p.availability = 'in_stock' AND po.availability = 'in_stock'
      AND po.currency = 'BRL' AND po.current_price_cents > 0
      AND po.captured_at > NOW() - INTERVAL '24 hours'
      AND NOT EXISTS (SELECT 1 FROM price_observations newer
        WHERE newer.product_id = p.id AND newer.captured_at > po.captured_at)
      AND o.affiliate_provider IS NOT NULL AND o.affiliate_provider <> ''
      AND o.affiliate_url IS NOT NULL
      AND lower(p.title || ' ' || coalesce(p.model, '')) LIKE ALL ($1::text[])
      ORDER BY po.current_price_cents, o.created_at DESC LIMIT 30`,
      [tokens.map((token) => `%${token}%`)],
    );
    return rows.map((row) => ({
      offerId: String(row.offer_id),
      title: String(row.title),
      brand: row.brand ? String(row.brand) : null,
      model: row.model ? String(row.model) : null,
      priceCents: Number(row.current_price_cents),
      affiliateUrl: String(row.affiliate_url),
    }));
  }
  async publishedProduct(
    id: string,
  ): Promise<{ title: string; model: string | null } | null> {
    const rows = await this.database.query(
      `SELECT p.title, p.model FROM offers o
      JOIN products p ON p.id = o.product_id WHERE o.id = $1
      AND EXISTS (SELECT 1 FROM publications pub WHERE pub.offer_id = o.id AND pub.status = 'published')`,
      [id],
    );
    return rows[0]
      ? {
          title: String(rows[0].title),
          model: rows[0].model ? String(rows[0].model) : null,
        }
      : null;
  }
}
export const productComparisonRepository = new ProductComparisonRepository();
