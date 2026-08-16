import { db } from "./db.js";

export interface PriceObservationRow {
  [key: string]: unknown;
  id: string;
  productId: string;
  currentPriceCents: number;
  previousPriceCents: number | null;
  currency: string;
  availability: string;
  capturedAt: string;
}

export class PriceObservationRepository {
  async insert(input: {
    productId: string;
    currentPriceCents: number;
    previousPriceCents?: number | null;
    currency: string;
    availability: string;
    evidence?: Record<string, unknown>;
    capturedAt: string;
  }): Promise<PriceObservationRow> {
    const rows = await db.query<PriceObservationRow>(
      `INSERT INTO price_observations (
        product_id, current_price_cents, previous_price_cents, currency,
        availability, evidence, captured_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING
        id, product_id, current_price_cents, previous_price_cents,
        currency, availability, captured_at`,
      [
        input.productId,
        input.currentPriceCents,
        input.previousPriceCents ?? null,
        input.currency,
        input.availability,
        JSON.stringify(input.evidence ?? {}),
        input.capturedAt,
      ],
    );
    return rows[0];
  }

  async getLatestForProduct(
    productId: string,
  ): Promise<PriceObservationRow | null> {
    const rows = await db.query<PriceObservationRow>(
      `SELECT id, product_id, current_price_cents, previous_price_cents,
        currency, availability, captured_at
       FROM price_observations
       WHERE product_id = $1
       ORDER BY captured_at DESC
       LIMIT 1`,
      [productId],
    );
    return rows[0] ?? null;
  }
}

export const priceObservationRepository = new PriceObservationRepository();
