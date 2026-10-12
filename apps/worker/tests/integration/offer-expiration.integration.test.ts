import { Client } from "pg";
import { expect, it, vi } from "vitest";

const query = vi.hoisted(() => vi.fn());
vi.mock("../../src/config/runtime.js", () => ({ telegramEnv: {} }));
vi.mock("../../src/adapters/persistence/db.js", () => ({ db: { query } }));
const { OfferRepository } =
  await import("../../src/adapters/persistence/offer-repository.js");

it.skipIf(!process.env.DATABASE_URL)(
  "expires overdue queue entries without changing valid or completed offers",
  async () => {
    const client = new Client({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 5000,
    });
    await client.connect();
    try {
      await client.query(`CREATE TEMP TABLE offers (
        id TEXT PRIMARY KEY, status TEXT, rejection_reason TEXT,
        expires_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
      )`);
      await client.query(`INSERT INTO offers (id, status, expires_at) VALUES
        ('link', 'needs_affiliate_link', NOW() - INTERVAL '1 minute'),
        ('scheduled', 'scheduled', NOW() - INTERVAL '1 minute'),
        ('approved', 'approved', NOW() - INTERVAL '1 minute'),
        ('valid', 'needs_affiliate_link', NOW() + INTERVAL '1 hour'),
        ('unlimited', 'needs_affiliate_link', NULL),
        ('published', 'published', NOW() - INTERVAL '1 minute'),
        ('publishing', 'publishing', NOW() - INTERVAL '1 minute')`);
      query.mockImplementation(async (sql: string, params?: unknown[]) => {
        return (await client.query(sql, params)).rows;
      });

      expect(await new OfferRepository().expireScheduledOffers()).toBe(3);
      const { rows } = await client.query(
        "SELECT id, status FROM offers ORDER BY id",
      );
      expect(
        Object.fromEntries(rows.map((row) => [row.id, row.status])),
      ).toEqual({
        approved: "expired",
        link: "expired",
        published: "published",
        publishing: "publishing",
        scheduled: "expired",
        unlimited: "needs_affiliate_link",
        valid: "needs_affiliate_link",
      });
    } finally {
      query.mockReset();
      await client.end();
    }
  },
);
