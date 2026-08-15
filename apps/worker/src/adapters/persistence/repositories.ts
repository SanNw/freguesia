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
        `SELECT id FROM approvals WHERE offer_id = $1 AND decision = $2 AND idempotency_key IS NOT NULL`,
        [input.offerId, input.decision],
      );
      if (existing.rows.length > 0) {
        return;
      }
      await client.query(
        `INSERT INTO approvals (id, offer_id, decision, actor_telegram_user_id, actor_username,
          notes, payload_before, payload_after)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          input.id, input.offerId, input.decision,
          input.actorTelegramUserId, input.actorUsername,
          input.notes, JSON.stringify(input.payloadBefore),
          input.payloadAfter ? JSON.stringify(input.payloadAfter) : null,
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
        input.id, input.offerId, input.channelId, input.telegramMessageId,
        input.finalCaption, input.finalImageUrl, input.finalAffiliateUrl,
        input.status, input.idempotencyKey, input.publishedAt,
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
        input.correlationId, input.entityType, input.entityId,
        input.eventType, input.actor, JSON.stringify(input.payload),
      ],
    );
  }
}

export const approvalRepository = new ApprovalRepository();
export const publicationRepository = new PublicationRepository();
export const workflowEventRepository = new WorkflowEventRepository();
