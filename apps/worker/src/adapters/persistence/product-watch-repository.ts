import { randomUUID } from "node:crypto";
import { db, type Database } from "./db.js";
import {
  assertShopperChatId,
  isNewPromotion,
  promotionFingerprint,
  type ProductIdentity,
  type PromotionCondition,
} from "../../domain/product-watch.js";
import type { WatchOffer } from "../sources/watched-product-source.js";

export const productWatchesSchema = `
CREATE TABLE IF NOT EXISTS shopper_users (
  chat_id BIGINT PRIMARY KEY CHECK (chat_id > 0 AND chat_id <= 9007199254740991),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  blocked BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS shopper_sessions (
  chat_id BIGINT PRIMARY KEY,
  action TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  expires_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS product_watches (
  id UUID PRIMARY KEY,
  chat_id BIGINT NOT NULL REFERENCES shopper_users(chat_id),
  product_key TEXT NOT NULL,
  identity JSONB NOT NULL,
  title TEXT NOT NULL,
  monitoring TEXT NOT NULL CHECK (monitoring IN ('direct', 'catalog_wait')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  baseline JSONB,
  last_checked_at TIMESTAMPTZ,
  last_attempt_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(chat_id, product_key)
);
CREATE INDEX IF NOT EXISTS idx_product_watches_active ON product_watches(last_checked_at) WHERE active;
CREATE TABLE IF NOT EXISTS product_watch_notifications (
  id UUID PRIMARY KEY,
  chat_id BIGINT NOT NULL REFERENCES shopper_users(chat_id),
  product_key TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sending', 'sent', 'unknown', 'rejected')),
  telegram_message_id BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(chat_id, product_key, fingerprint)
);`;

export interface WatchRow {
  id: string;
  chatId: number;
  identity: ProductIdentity;
  title: string;
  active: boolean;
  monitoring: string;
  baseline: PromotionCondition | null;
}
function mapWatch(row: Record<string, unknown>): WatchRow {
  return {
    id: String(row.id),
    chatId: Number(row.chat_id),
    identity: row.identity as ProductIdentity,
    title: String(row.title),
    active: Boolean(row.active),
    monitoring: String(row.monitoring),
    baseline: row.baseline as PromotionCondition | null,
  };
}
export interface CatalogWatchRow extends Record<string, unknown> {
  offer_id: string;
  canonical_url: string;
  title: string;
  affiliate_url: string;
  affiliate_provider: string;
  current_price_cents: string | number;
  coupon_code: string | null;
  is_current?: boolean;
}
const eligibleCatalog = `SELECT o.id AS offer_id, p.canonical_url, p.title,
  o.affiliate_url, o.affiliate_provider, po.current_price_cents, o.coupon_code
  FROM offers o JOIN products p ON p.id = o.product_id
  JOIN price_observations po ON po.id = o.source_observation_id
  WHERE o.status IN ('approved', 'scheduled', 'published')
    AND (o.expires_at IS NULL OR o.expires_at > NOW())
    AND p.availability = 'in_stock' AND po.availability = 'in_stock'
    AND po.current_price_cents > 0 AND po.currency = 'BRL'
    AND po.captured_at > NOW() - INTERVAL '24 hours'
    AND NOT EXISTS (SELECT 1 FROM price_observations newer
      WHERE newer.product_id = p.id AND newer.captured_at > po.captured_at)
    AND o.affiliate_url IS NOT NULL AND o.affiliate_provider IS NOT NULL
    AND o.affiliate_provider <> ''`;

export class ProductWatchRepository {
  constructor(
    private readonly database: Pick<Database, "query" | "withTransaction"> = db,
  ) {}

  async start(chatId: number): Promise<void> {
    assertShopperChatId(chatId);
    await this.database.query(
      `INSERT INTO shopper_users (chat_id) VALUES ($1)
      ON CONFLICT (chat_id) DO UPDATE SET blocked = FALSE, updated_at = NOW()`,
      [chatId],
    );
  }
  async hasStarted(chatId: number): Promise<boolean> {
    assertShopperChatId(chatId);
    return (
      (
        await this.database.query(
          `SELECT chat_id FROM shopper_users WHERE chat_id = $1 AND NOT blocked`,
          [chatId],
        )
      ).length === 1
    );
  }
  async subscribe(
    chatId: number,
    input: {
      identity: ProductIdentity;
      title: string;
      monitoring: string;
      baseline: PromotionCondition | null;
    },
  ): Promise<WatchRow & { alreadyWatching: boolean }> {
    assertShopperChatId(chatId);
    return this.database.withTransaction(async (client) => {
      // All mutations for a user serialize on this existing consent row.
      const user = await client.query(
        `SELECT chat_id FROM shopper_users WHERE chat_id = $1 AND NOT blocked FOR UPDATE`,
        [chatId],
      );
      if (!user.rows.length)
        throw new Error(
          "Inicie uma conversa privada com o bot antes de acompanhar produtos.",
        );
      const existing = await client.query(
        `SELECT * FROM product_watches WHERE chat_id = $1 AND product_key = $2`,
        [chatId, input.identity.key],
      );
      if (existing.rows[0]?.active)
        return { ...mapWatch(existing.rows[0]), alreadyWatching: true };
      const count = await client.query(
        `SELECT COUNT(*) AS count FROM product_watches WHERE chat_id = $1 AND active`,
        [chatId],
      );
      if (Number(count.rows[0]?.count) >= 20)
        throw new Error(
          "Você já acompanha 20 produtos. Remova um alerta para adicionar outro.",
        );
      const result = await client.query(
        `INSERT INTO product_watches (id, chat_id, product_key, identity, title, monitoring, baseline)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (chat_id, product_key) DO UPDATE SET active = TRUE, identity = EXCLUDED.identity,
          title = EXCLUDED.title, monitoring = EXCLUDED.monitoring, baseline = EXCLUDED.baseline, updated_at = NOW()
        RETURNING *`,
        [
          existing.rows[0]?.id ?? randomUUID(),
          chatId,
          input.identity.key,
          JSON.stringify(input.identity),
          input.title,
          input.monitoring,
          input.baseline ? JSON.stringify(input.baseline) : null,
        ],
      );
      return { ...mapWatch(result.rows[0]), alreadyWatching: false };
    });
  }
  async list(chatId: number): Promise<WatchRow[]> {
    assertShopperChatId(chatId);
    return (
      await this.database.query(
        `SELECT * FROM product_watches WHERE chat_id = $1 AND active ORDER BY created_at`,
        [chatId],
      )
    ).map(mapWatch);
  }
  async remove(chatId: number, id: string): Promise<boolean> {
    assertShopperChatId(chatId);
    return (
      (
        await this.database.query(
          `UPDATE product_watches SET active = FALSE, updated_at = NOW() WHERE chat_id = $1 AND id = $2 AND active RETURNING id`,
          [chatId, id],
        )
      ).length === 1
    );
  }
  async productsToCheck(limit: number): Promise<ProductIdentity[]> {
    const rows = await this.database.query(
      `SELECT w.product_key, (array_agg(w.identity ORDER BY w.created_at))[1] AS identity
      FROM product_watches w JOIN shopper_users u ON u.chat_id = w.chat_id
      WHERE w.active AND NOT u.blocked GROUP BY w.product_key
      ORDER BY MIN(w.last_checked_at) ASC NULLS FIRST, MIN(w.created_at) LIMIT $1`,
      [Math.min(20, Math.max(1, limit))],
    );
    return rows.map((row) => row.identity as ProductIdentity);
  }
  async touchProduct(key: string): Promise<void> {
    await this.database.query(
      `UPDATE product_watches SET last_checked_at = NOW() WHERE product_key = $1 AND active`,
      [key],
    );
  }
  async subscribers(key: string): Promise<WatchRow[]> {
    return (
      await this.database.query(
        `SELECT w.* FROM product_watches w JOIN shopper_users u ON u.chat_id = w.chat_id
      WHERE w.product_key = $1 AND w.active AND NOT u.blocked
      ORDER BY w.last_attempt_at ASC NULLS FIRST, w.created_at`,
        [key],
      )
    ).map(mapWatch);
  }
  async canDeliver(chatId: number, watchId: string): Promise<boolean> {
    return (
      (
        await this.database.query(
          `SELECT w.id FROM product_watches w JOIN shopper_users u ON u.chat_id = w.chat_id
      WHERE w.chat_id = $1 AND w.id = $2 AND w.active AND NOT u.blocked`,
          [chatId, watchId],
        )
      ).length === 1
    );
  }
  async reserve(watch: WatchRow, offer: WatchOffer): Promise<string | null> {
    assertShopperChatId(watch.chatId);
    const condition = { priceCents: offer.priceCents, coupon: offer.coupon };
    const fingerprint = promotionFingerprint(offer.priceCents, offer.coupon);
    if (offer.identity.key !== watch.identity.key) return null;
    return this.database.withTransaction(async (client) => {
      const rows = await client.query(
        `SELECT w.* FROM product_watches w JOIN shopper_users u ON u.chat_id = w.chat_id
        WHERE w.id = $1 AND w.chat_id = $2 AND w.active AND NOT u.blocked FOR UPDATE OF w`,
        [watch.id, watch.chatId],
      );
      if (!rows.rows.length) return null;
      const existing = await client.query(
        `SELECT status FROM product_watch_notifications WHERE chat_id = $1 AND product_key = $2 AND fingerprint = $3`,
        [watch.chatId, watch.identity.key, fingerprint],
      );
      if (existing.rows[0] && existing.rows[0].status !== "rejected")
        return null;
      if (
        !existing.rows.length &&
        !isNewPromotion(
          rows.rows[0].baseline as PromotionCondition | null,
          condition,
        )
      )
        return null;
      const result = await client.query(
        `INSERT INTO product_watch_notifications (id, chat_id, product_key, fingerprint, payload, status)
        VALUES ($1, $2, $3, $4, $5, 'sending')
        ON CONFLICT (chat_id, product_key, fingerprint) DO UPDATE SET status = 'sending', payload = EXCLUDED.payload, updated_at = NOW()
          WHERE product_watch_notifications.status = 'rejected' RETURNING id`,
        [
          randomUUID(),
          watch.chatId,
          watch.identity.key,
          fingerprint,
          JSON.stringify(offer),
        ],
      );
      if (!result.rows.length) return null;
      await client.query(
        `UPDATE product_watches SET baseline = $2, last_attempt_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [watch.id, JSON.stringify(condition)],
      );
      return String(result.rows[0].id);
    });
  }
  async markSent(id: string, messageId: number): Promise<void> {
    await this.database.query(
      `UPDATE product_watch_notifications SET status = 'sent', telegram_message_id = $2, updated_at = NOW() WHERE id = $1 AND status = 'sending'`,
      [id, messageId],
    );
  }
  async markUnknown(id: string): Promise<void> {
    await this.database.query(
      `UPDATE product_watch_notifications SET status = 'unknown', updated_at = NOW() WHERE id = $1 AND status = 'sending'`,
      [id],
    );
  }
  async markRejected(id: string): Promise<void> {
    await this.database.query(
      `UPDATE product_watch_notifications SET status = 'rejected', updated_at = NOW() WHERE id = $1 AND status = 'sending'`,
      [id],
    );
  }
  async block(chatId: number): Promise<void> {
    await this.database.query(
      `UPDATE shopper_users SET blocked = TRUE, updated_at = NOW() WHERE chat_id = $1`,
      [chatId],
    );
  }
  async publishedOffer(id: string): Promise<CatalogWatchRow | null> {
    const rows = await this.database.query<CatalogWatchRow>(
      `SELECT o.id AS offer_id, p.canonical_url, p.title,
      o.affiliate_url, o.affiliate_provider, po.current_price_cents, o.coupon_code,
      (o.status IN ('approved', 'scheduled', 'published') AND (o.expires_at IS NULL OR o.expires_at > NOW()) AND p.availability = 'in_stock'
        AND po.availability = 'in_stock' AND po.currency = 'BRL'
        AND po.captured_at > NOW() - INTERVAL '24 hours'
        AND NOT EXISTS (SELECT 1 FROM price_observations newer
          WHERE newer.product_id = p.id AND newer.captured_at > po.captured_at)) AS is_current
      FROM offers o JOIN products p ON p.id = o.product_id
      JOIN price_observations po ON po.id = o.source_observation_id
      WHERE o.id = $1
      AND EXISTS (SELECT 1 FROM publications pub WHERE pub.offer_id = o.id AND pub.status = 'published')`,
      [id],
    );
    return rows[0] ?? null;
  }
  async isPublicationOrigin(
    offerId: string,
    channelId: number,
    messageId: number,
  ): Promise<boolean> {
    return (
      (
        await this.database.query(
          `SELECT id FROM publications WHERE offer_id = $1
      AND channel_id = $2 AND telegram_message_id = $3 AND status = 'published'`,
          [offerId, String(channelId), messageId],
        )
      ).length === 1
    );
  }
  async catalogCandidates(
    identity: ProductIdentity,
  ): Promise<CatalogWatchRow[]> {
    // The substring is a query prefilter only. The source checks the full parsed
    // store/shop/item/variant key before exposing any catalog price.
    return this.database.query<CatalogWatchRow>(
      `${eligibleCatalog} AND p.canonical_url LIKE $1
      ORDER BY po.current_price_cents ASC, o.created_at DESC LIMIT 100`,
      [`%${identity.itemId}%`],
    );
  }
}
export const productWatchRepository = new ProductWatchRepository();
