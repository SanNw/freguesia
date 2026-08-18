import { db } from "./db.js";

export class ApprovalRepository {
  async recordApproval(input: {
    id: string;
    offerId: string;
    decision: string;
    actorTelegramUserId: string;
    actorUsername: string | null;
    notes: string | null;
    payloadBefore: Record<string, unknown>;
    payloadAfter: Record<string, unknown> | null;
    idempotencyKey: string;
  }): Promise<void> {
    await db.withTransaction(async (client) => {
      const existing = await client.query(
        `SELECT id FROM approvals WHERE idempotency_key = $1`,
        [input.idempotencyKey],
      );
      if (existing.rows.length > 0) {
        return;
      }
      await client.query(
        `INSERT INTO approvals (id, offer_id, decision, actor_telegram_user_id, actor_username,
          notes, payload_before, payload_after, idempotency_key)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          input.id,
          input.offerId,
          input.decision,
          input.actorTelegramUserId,
          input.actorUsername,
          input.notes,
          JSON.stringify(input.payloadBefore),
          input.payloadAfter ? JSON.stringify(input.payloadAfter) : null,
          input.idempotencyKey,
        ],
      );
    });
  }

  async getApprovalsForOffer(offerId: string) {
    return db.query(
      `SELECT id, offer_id, decision, actor_telegram_user_id, actor_username, notes, decided_at
       FROM approvals WHERE offer_id = $1 ORDER BY decided_at DESC`,
      [offerId],
    );
  }
}

export class PublicationRepository {
  async getRateLimitSnapshot(): Promise<{
    lastPublishedAt: string | null;
    hourly: number;
    daily: number;
  }> {
    const rows = await db.query<{
      last_published_at: string | null;
      hourly: string;
      daily: string;
    }>(
      `SELECT MAX(published_at) AS last_published_at,
        COUNT(*) FILTER (WHERE published_at >= NOW() - INTERVAL '1 hour') AS hourly,
        COUNT(*) FILTER (WHERE (published_at AT TIME ZONE 'America/Sao_Paulo')::date =
          (NOW() AT TIME ZONE 'America/Sao_Paulo')::date) AS daily
       FROM publications WHERE status = 'published'`,
    );
    return {
      lastPublishedAt: rows[0]?.last_published_at ?? null,
      hourly: Number(rows[0]?.hourly ?? 0),
      daily: Number(rows[0]?.daily ?? 0),
    };
  }

  async insert(input: {
    id: string;
    offerId: string;
    channelId: string;
    telegramMessageId: number | null;
    finalCaption: string;
    finalImageUrl: string | null;
    finalAffiliateUrl: string;
    status: string;
    idempotencyKey: string;
    publishedAt: string | null;
  }): Promise<void> {
    await db.query(
      `INSERT INTO publications (id, offer_id, channel_id, telegram_message_id, final_caption,
        final_image_url, final_affiliate_url, status, idempotency_key, published_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        input.id,
        input.offerId,
        input.channelId,
        input.telegramMessageId,
        input.finalCaption,
        input.finalImageUrl,
        input.finalAffiliateUrl,
        input.status,
        input.idempotencyKey,
        input.publishedAt,
      ],
    );
  }

  async existsByIdempotencyKey(key: string): Promise<boolean> {
    const rows = await db.query(
      `SELECT 1 FROM publications WHERE idempotency_key = $1`,
      [key],
    );
    return rows.length > 0;
  }

  async existsForProductToday(productId: string): Promise<boolean> {
    const rows = await db.query(
      `SELECT 1
       FROM publications p
       JOIN offers o ON o.id = p.offer_id
       WHERE o.product_id = $1
         AND p.status = 'published'
         AND (p.published_at AT TIME ZONE 'America/Sao_Paulo')::date =
             (NOW() AT TIME ZONE 'America/Sao_Paulo')::date
       LIMIT 1`,
      [productId],
    );
    return rows.length > 0;
  }
}

export class WorkflowEventRepository {
  async record(input: {
    correlationId: string;
    entityType: string;
    entityId: string;
    eventType: string;
    actor: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    await db.query(
      `INSERT INTO workflow_events (correlation_id, entity_type, entity_id, event_type, actor, payload)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        input.correlationId,
        input.entityType,
        input.entityId,
        input.eventType,
        input.actor,
        JSON.stringify(input.payload),
      ],
    );
  }
}

export const approvalRepository = new ApprovalRepository();
export const publicationRepository = new PublicationRepository();
export const workflowEventRepository = new WorkflowEventRepository();
