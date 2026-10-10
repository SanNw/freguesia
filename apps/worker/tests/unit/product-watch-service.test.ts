import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../../src/config/env.js", () => ({ env: {} }));
import { ProductWatchService } from "../../src/application/product-watch-service.js";
import { parseProductIdentity } from "../../src/domain/product-watch.js";
import type {
  ProductWatchRepository,
  WatchRow,
} from "../../src/adapters/persistence/product-watch-repository.js";
import type {
  WatchedProductSource,
  WatchOffer,
} from "../../src/adapters/sources/watched-product-source.js";

const identity = parseProductIdentity("https://shopee.com.br/product/12/34")!;
const logger = { warn: () => {}, error: () => {}, info: () => {} } as never;
const watch: WatchRow = {
  id: "12345678-1234-4123-8123-123456789abc",
  chatId: 123,
  identity,
  title: "Placa <script>",
  active: true,
  monitoring: "direct",
  baseline: null,
};
let rows: WatchRow[];
let offer: WatchOffer;
let reserved: Set<string>;
let unknown: number;
let blocked: number;
let sendError: Error | null;
let messages: Array<{ chatId: string; markdown: string; options: unknown }>;
let sourceChecks: number;
let canDeliver: boolean;
const repo = {
  start: async () => {},
  hasStarted: async () => true,
  subscribe: async (
    chatId: number,
    input: {
      identity: typeof identity;
      title: string;
      monitoring: string;
      baseline: unknown;
    },
  ) => ({ ...watch, ...input, chatId, alreadyWatching: false }),
  list: async (chatId: number) => rows.filter((r) => r.chatId === chatId),
  remove: async (chatId: number, id: string) =>
    rows.some((r) => r.id === id && r.chatId === chatId),
  productsToCheck: async (limit: number) =>
    Array.from(
      new Map(rows.map((r) => [r.identity.key, r.identity])).values(),
    ).slice(0, limit),
  subscribers: async () => rows,
  canDeliver: async () => canDeliver,
  touchProduct: async () => {},
  reserve: async (row: WatchRow, candidate: WatchOffer) => {
    const key = `${row.chatId}:${candidate.identity.key}:${candidate.priceCents}:${candidate.coupon}`;
    if (reserved.has(key)) return null;
    reserved.add(key);
    return key;
  },
  markSent: async () => {},
  markUnknown: async () => {
    unknown++;
  },
  markRejected: async (key: string) => {
    reserved.delete(key);
  },
  block: async () => {
    blocked++;
    rows = [];
  },
} as unknown as ProductWatchRepository;
const source = {
  publicOffer: async () => offer,
  catalog: async () => offer,
  check: async () => {
    sourceChecks++;
    return offer;
  },
} as unknown as WatchedProductSource;
const gateway = {
  sendRichMessage: async (
    input: { chatId: string; markdown: string },
    options: unknown,
  ) => {
    if (sendError) throw sendError;
    messages.push({ ...input, options });
    return { messageId: 1 };
  },
};
const service = new ProductWatchService(repo, source, async () => identity);

beforeEach(() => {
  rows = [{ ...watch }];
  reserved = new Set();
  unknown = 0;
  blocked = 0;
  sendError = null;
  messages = [];
  sourceChecks = 0;
  canDeliver = true;
  offer = {
    identity,
    title: "Placa <script>",
    affiliateUrl: "https://s.shopee.com.br/own",
    priceCents: 10000,
    coupon: null,
    offerId: "12345678-1234-4123-8123-123456789abc",
    availability: "in_stock",
  };
});
describe("shopper services", () => {
  it("requires a positive safe private chat ID for every user-facing operation", async () => {
    for (const id of [-100123, 0, Number.MAX_SAFE_INTEGER + 1]) {
      await expect(service.startShopper(id)).rejects.toThrow(/privada|válido/);
      await expect(service.listProductWatches(id)).rejects.toThrow(
        /privada|válido/,
      );
      await expect(
        service.subscribeUrl(id, identity.canonicalUrl),
      ).rejects.toThrow(/privada|válido/);
    }
  });
  it("only removes the actor's own watch", async () => {
    expect(await service.removeProductWatch(999, watch.id)).toBe(false);
    expect(await service.removeProductWatch(123, watch.id)).toBe(true);
  });
  it("registers the canonical product, never the user's referral", async () => {
    const result = await service.subscribeUrl(
      123,
      "https://s.shopee.com.br/other-affiliate",
    );
    expect(result.canonicalUrl).toBe("https://shopee.com.br/product/12/34");
    expect(result.monitoring).toBe("direct");
  });
  it("seeds a publication baseline without sending its current condition", async () => {
    let baseline: unknown;
    const baselineRepo = {
      ...repo,
      subscribe: async (_chat: number, input: { baseline: unknown }) => {
        baseline = input.baseline;
        return { ...watch, alreadyWatching: false };
      },
    } as unknown as ProductWatchRepository;
    await new ProductWatchService(baselineRepo, source).subscribeOffer(
      123,
      offer.offerId!,
    );
    expect(baseline).toEqual({ priceCents: 10000, coupon: null });
    expect(messages).toHaveLength(0);
  });
  it("shares checks and deduplicates concurrent scheduler runs", async () => {
    rows.push({
      ...watch,
      id: "87654321-1234-4123-8123-123456789abc",
      chatId: 456,
    });
    await Promise.all([
      service.dispatchProductWatches(logger, 20, gateway),
      service.dispatchProductWatches(logger, 20, gateway),
    ]);
    expect(messages).toHaveLength(2);
    expect(messages.map((m) => m.chatId).sort()).toEqual(["123", "456"]);
    expect(messages[0].options).toEqual({ retryAmbiguousErrors: false });
    expect(messages[0].markdown).toContain("https://s.shopee.com.br/own");
    expect(messages[0].markdown).not.toContain("<script>");
    expect(sourceChecks).toBe(2);
  });
  it("keeps an ambiguous reservation and retries only explicit refusal", async () => {
    sendError = new Error("timeout");
    await service.dispatchProductWatches(logger, 20, gateway);
    sendError = null;
    await service.dispatchProductWatches(logger, 20, gateway);
    expect(messages).toHaveLength(0);
    expect(unknown).toBe(1);
  });
  it("blocks a recipient on confirmed Telegram 403", async () => {
    const error = new Error(
      "Telegram sendRichMessage failed: Forbidden: bot was blocked by the user",
    );
    error.name = "TelegramMessageRejectedError";
    Object.assign(error, { errorCode: 403 });
    sendError = error;
    await service.dispatchProductWatches(logger, 20, gateway);
    expect(blocked).toBe(1);
  });
  it("retries a definitive 400 and never treats it as ambiguous", async () => {
    const error = new Error("Bad Request");
    error.name = "TelegramMessageRejectedError";
    Object.assign(error, { errorCode: 400 });
    sendError = error;
    await service.dispatchProductWatches(logger, 20, gateway);
    sendError = null;
    await service.dispatchProductWatches(logger, 20, gateway);
    expect(messages).toHaveLength(1);
    expect(unknown).toBe(0);
  });
  it("caps delivery attempts at 20 even for hundreds of subscribers", async () => {
    rows = Array.from({ length: 50 }, (_, i) => ({ ...watch, chatId: i + 1 }));
    const result = await service.dispatchProductWatches(logger, 999, gateway);
    expect(result.sent).toBe(20);
    expect(messages).toHaveLength(20);
    expect(sourceChecks).toBe(1);
  });
  it("does not turn source outages into a zero-price offer", async () => {
    const unavailable = {
      ...source,
      check: async () => {
        throw new Error("CAPTCHA");
      },
    } as unknown as WatchedProductSource;
    const result = await new ProductWatchService(
      repo,
      unavailable,
    ).dispatchProductWatches(logger, 20, gateway);
    expect(result).toEqual({ checked: 1, sent: 0, unavailable: 1 });
    expect(messages).toHaveLength(0);
  });
  it("suppresses delivery after a concurrent unsubscribe", async () => {
    canDeliver = false;
    expect(await service.dispatchProductWatches(logger, 20, gateway)).toEqual({
      checked: 1,
      sent: 0,
      unavailable: 0,
    });
    expect(messages).toHaveLength(0);
  });
});
