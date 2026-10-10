import { describe, expect, it, vi } from "vitest";
vi.mock("../../src/config/env.js", () => ({ env: {} }));
import { ProductWatchRepository } from "../../src/adapters/persistence/product-watch-repository.js";
import { parseProductIdentity } from "../../src/domain/product-watch.js";
const identity = parseProductIdentity("https://shopee.com.br/product/12/34")!;
const watch = {
  id: "12345678-1234-4123-8123-123456789abc",
  chat_id: "123",
  identity,
  title: "Placa",
  monitoring: "direct",
  active: true,
  baseline: { priceCents: 10000, coupon: "SAVE" },
};

describe("product watch persistence boundaries", () => {
  it("allows tracking a historical published product without treating its price as current", async () => {
    let statement = "";
    const repository = new ProductWatchRepository({
      query: async (query: string) => {
        statement = query;
        return [];
      },
    } as never);
    await repository.publishedOffer(watch.id);
    expect(statement).toContain("AS is_current");
    expect(statement).toContain("pub.status = 'published'");
    expect(statement).not.toContain(
      "AND p.availability = 'in_stock' AND po.availability = 'in_stock'",
    );
  });
  it("restricts alert catalog prices to recent observations", async () => {
    let statement = "";
    const repository = new ProductWatchRepository({
      query: async (query: string) => {
        statement = query;
        return [];
      },
    } as never);
    await repository.catalogCandidates(identity);
    expect(statement).toContain("po.captured_at > NOW() - INTERVAL '24 hours'");
    expect(statement).toContain("NOT EXISTS");
  });
  it("locks the shopper before enforcing the 20-watch cap", async () => {
    const sql: string[] = [];
    const client = {
      query: async (query: string) => {
        sql.push(query);
        if (query.includes("FROM shopper_users"))
          return { rows: [{ chat_id: "123" }] };
        if (query.includes("COUNT(*)")) return { rows: [{ count: "20" }] };
        return { rows: [] };
      },
    };
    const repository = new ProductWatchRepository({
      withTransaction: async (fn: (value: unknown) => Promise<unknown>) =>
        fn(client),
    } as never);
    await expect(
      repository.subscribe(123, {
        identity,
        title: "Placa",
        monitoring: "direct",
        baseline: null,
      }),
    ).rejects.toThrow(/20/);
    expect(sql[0]).toMatch(/FOR UPDATE/);
    expect(
      sql.some((query) => query.includes("INSERT INTO product_watches")),
    ).toBe(false);
  });
  it("scopes removal to actor and watch, using query parameters", async () => {
    let statement = "";
    let params: unknown[] = [];
    const repository = new ProductWatchRepository({
      query: async (query: string, values: unknown[]) => {
        statement = query;
        params = values;
        return [];
      },
    } as never);
    expect(await repository.remove(123, watch.id)).toBe(false);
    expect(statement).toMatch(/chat_id = \$1 AND id = \$2/);
    expect(params).toEqual([123, watch.id]);
  });
  it("does not reserve an unchanged baseline or a price increase", async () => {
    const sql: string[] = [];
    const client = {
      query: async (query: string) => {
        sql.push(query);
        if (query.includes("FROM product_watches")) return { rows: [watch] };
        return { rows: [] };
      },
    };
    const repository = new ProductWatchRepository({
      withTransaction: async (fn: (value: unknown) => Promise<unknown>) =>
        fn(client),
    } as never);
    for (const priceCents of [10000, 11000]) {
      expect(
        await repository.reserve(
          {
            id: watch.id,
            chatId: 123,
            identity,
            title: watch.title,
            monitoring: "direct",
            active: true,
            baseline: watch.baseline,
          },
          {
            identity,
            title: watch.title,
            priceCents,
            coupon: "SAVE",
            affiliateUrl: "https://s.shopee.com.br/own",
            availability: "in_stock",
            offerId: null,
          },
        ),
      ).toBeNull();
    }
    expect(
      sql.some((query) =>
        query.includes("INSERT INTO product_watch_notifications"),
      ),
    ).toBe(false);
  });
  it("persists unknown transport outcomes without deleting the reservation", async () => {
    let statement = "";
    const repository = new ProductWatchRepository({
      query: async (query: string) => {
        statement = query;
        return [];
      },
    } as never);
    await repository.markUnknown("notification-id");
    expect(statement).toContain("status = 'unknown'");
    expect(statement).not.toContain("DELETE");
  });
});
