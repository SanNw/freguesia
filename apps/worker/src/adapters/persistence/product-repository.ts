import { db } from "./db.js";

export interface ProductRow {
  [key: string]: unknown;
  id: string;
  sourceId: string;
  externalId: string;
  canonicalUrl: string;
  title: string;
  normalizedTitle: string;
  brand: string | null;
  model: string | null;
  gtin: string | null;
  category: string | null;
  currency: string;
  imageUrl: string | null;
  availability: string;
}

export class ProductRepository {
  async upsert(input: {
    sourceId: string;
    externalId: string;
    canonicalUrl: string;
    title: string;
    normalizedTitle: string;
    brand?: string | null;
    model?: string | null;
    gtin?: string | null;
    category?: string | null;
    currency: string;
    imageUrl?: string | null;
    availability: string;
  }): Promise<ProductRow> {
    const rows = await db.query<ProductRow>(
      `INSERT INTO products (
        id, source_id, external_id, canonical_url, title, normalized_title,
        brand, model, gtin, category, currency, image_url, availability,
        first_seen_at, last_seen_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
      ON CONFLICT (source_id, external_id) DO UPDATE SET
        canonical_url = EXCLUDED.canonical_url,
        title = EXCLUDED.title,
        normalized_title = EXCLUDED.normalized_title,
        brand = COALESCE(EXCLUDED.brand, products.brand),
        model = COALESCE(EXCLUDED.model, products.model),
        gtin = COALESCE(EXCLUDED.gtin, products.gtin),
        category = COALESCE(EXCLUDED.category, products.category),
        image_url = COALESCE(EXCLUDED.image_url, products.image_url),
        availability = EXCLUDED.availability,
        last_seen_at = NOW(),
        updated_at = NOW()
      RETURNING
        id, source_id, external_id, canonical_url, title, normalized_title,
        brand, model, gtin, category, currency, image_url, availability`,
      [
        crypto.randomUUID(),
        input.sourceId,
        input.externalId,
        input.canonicalUrl,
        input.title,
        input.normalizedTitle,
        input.brand ?? null,
        input.model ?? null,
        input.gtin ?? null,
        input.category ?? null,
        input.currency,
        input.imageUrl ?? null,
        input.availability,
      ],
    );
    return rows[0];
  }

  async getById(id: string): Promise<ProductRow | null> {
    const rows = await db.query<ProductRow>(
      `SELECT id, source_id, external_id, canonical_url, title, normalized_title,
        brand, model, gtin, category, currency, image_url, availability
       FROM products WHERE id = $1`,
      [id],
    );
    return rows[0] ?? null;
  }
}

export const productRepository = new ProductRepository();
