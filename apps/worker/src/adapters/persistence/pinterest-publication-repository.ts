import { db } from "./db.js";

class PinterestPublicationRepository {
  async reserve(input: {
    id: string;
    offerId: string;
    boardId: string;
    idempotencyKey: string;
    title: string;
    description: string;
    imageUrl: string;
    affiliateUrl: string;
  }): Promise<boolean> {
    const rows = await db.query<{ id: string }>(
      `INSERT INTO pinterest_publications
        (id, offer_id, board_id, idempotency_key, title, description, image_url, affiliate_url, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'publishing')
       ON CONFLICT DO NOTHING RETURNING id`,
      [
        input.id,
        input.offerId,
        input.boardId,
        input.idempotencyKey,
        input.title,
        input.description,
        input.imageUrl,
        input.affiliateUrl,
      ],
    );
    return rows.length === 1;
  }

  async markPublished(
    id: string,
    externalId: string,
    externalUrl: string,
  ): Promise<void> {
    await db.query(
      `UPDATE pinterest_publications SET status = 'published', external_id = $1,
       external_url = $2, published_at = NOW(), updated_at = NOW() WHERE id = $3`,
      [externalId, externalUrl, id],
    );
  }

  async markFailed(id: string, error: unknown): Promise<void> {
    await db.query(
      `UPDATE pinterest_publications SET status = 'failed', error_message = $1,
       updated_at = NOW() WHERE id = $2`,
      [error instanceof Error ? error.message : String(error), id],
    );
  }
}

export const pinterestPublicationRepository =
  new PinterestPublicationRepository();
