import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/config/runtime.js", () => ({
  marketplaceEnv: {
    SHOPEE_APP_ID: "app",
    SHOPEE_SECRET: "secret",
    SHOPEE_AFFILIATE_API_URL: "https://example.com/graphql",
  },
}));
import {
  readAwinMetrics,
  readShopeeMetrics,
} from "../../src/adapters/reporting/performance-metrics.js";
import { getReportPeriod } from "../../src/domain/performance-report.js";

const period = getReportPeriod("monthly", new Date("2026-10-09T12:00:00Z"));

beforeEach(() => {
  vi.stubEnv("AWIN_PUBLISHER_ID", "123");
  vi.stubEnv("AWIN_API_TOKEN", "test");
});

describe("Awin metrics", () => {
  it("does not turn an absent click count into zero", async () => {
    const fetcher = async (input: string | URL | Request) =>
      Response.json(
        new URL(String(input)).pathname.endsWith("/reports/advertiser")
          ? [{ clicks: null }]
          : [],
      );
    await expect(
      readAwinMetrics(period, fetcher as typeof fetch),
    ).rejects.toThrow();
  });

  it("does not turn an absent purchase amount into zero", async () => {
    const fetcher = async (input: string | URL | Request) =>
      Response.json(
        new URL(String(input)).pathname.endsWith("/reports/advertiser")
          ? [{ clicks: 1 }]
          : [
              {
                id: 1,
                type: "Sale",
                commissionStatus: "pending",
                saleAmount: { amount: null, currency: "BRL" },
                commissionAmount: { amount: 0.27, currency: "BRL" },
              },
            ],
      );
    await expect(
      readAwinMetrics(period, fetcher as typeof fetch),
    ).rejects.toThrow();
  });
  it("counts purchases instead of bonuses and sums money in cents by currency", async () => {
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      expect(url.searchParams.get("timezone")).toBe("America/Sao_Paulo");
      return Response.json(
        url.pathname.endsWith("/reports/advertiser")
          ? [
              {
                advertiserId: 1,
                advertiserName: "Loja",
                currency: "BRL",
                clicks: 3,
              },
            ]
          : [
              {
                id: 1,
                type: "Sale",
                commissionStatus: "approved",
                saleAmount: { amount: 125.25, currency: "BRL" },
                commissionAmount: { amount: 2.51, currency: "BRL" },
                basketProducts: null,
              },
              {
                id: 2,
                type: "Mobile App Purchase",
                commissionStatus: "pending",
                saleAmount: { amount: 50, currency: "BRL" },
                commissionAmount: { amount: 1, currency: "BRL" },
                basketProducts: null,
              },
              {
                id: 3,
                type: "Bonus",
                commissionStatus: "approved",
              },
            ],
      );
    });
    const result = await readAwinMetrics(period, fetcher as typeof fetch);
    expect(result.clicks).toBe(3);
    expect(result.orders).toMatchObject({ total: 2, approved: 1, pending: 1 });
    expect(result.confirmedCommissions).toEqual([
      { currency: "BRL", amountCents: 251 },
    ]);
    expect(result.estimatedCommissions).toEqual([
      { currency: "BRL", amountCents: 100 },
    ]);
    expect(result.sales).toEqual([{ currency: "BRL", amountCents: 17525 }]);
  });

  it("rejects an invalid successful API payload rather than reporting zero", async () => {
    await expect(
      readAwinMetrics(period, (async () =>
        Response.json({ error: "bad" })) as typeof fetch),
    ).rejects.toThrow();
  });
});

describe("Shopee conversions", () => {
  it("does not report a missing price as a free purchase", async () => {
    const fetcher = async () =>
      Response.json({
        data: {
          conversionReport: {
            nodes: [
              {
                orders: [
                  {
                    orderId: "1",
                    orderStatus: "COMPLETED",
                    items: [
                      {
                        itemName: "Mochila",
                        qty: 1,
                        itemPrice: null,
                        itemTotalCommission: "0.84",
                      },
                    ],
                  },
                ],
              },
            ],
            pageInfo: { hasNextPage: false, scrollId: "" },
          },
        },
      });
    await expect(
      readShopeeMetrics(period, fetcher as typeof fetch),
    ).rejects.toThrow();
  });
  it("reads all pages without double-counting repeated orders or claiming clicks", async () => {
    let page = 0;
    const order = {
      orderId: "1",
      orderStatus: "COMPLETED",
      items: [
        {
          itemName: "Mochila",
          qty: 2,
          itemPrice: "10.50",
          itemTotalCommission: "0.84",
        },
      ],
    };
    const fetcher = vi.fn(async (_input: unknown, init?: RequestInit) => {
      if (page > 0)
        expect(JSON.parse(String(init?.body)).query).toContain(
          'scrollId: "next"',
        );
      return Response.json({
        data: {
          conversionReport: {
            nodes: [
              { conversionId: "c1", totalCommission: "0.84", orders: [order] },
            ],
            pageInfo:
              page++ === 0
                ? { hasNextPage: true, scrollId: "next" }
                : { hasNextPage: false, scrollId: "" },
          },
        },
      });
    });
    const result = await readShopeeMetrics(period, fetcher as typeof fetch);
    expect(result.clicks).toBeNull();
    expect(result.orders).toMatchObject({ total: 1, approved: 1 });
    expect(result.estimatedCommissions).toEqual([
      { currency: "BRL", amountCents: 84 },
    ]);
    expect(result.confirmedCommissions).toBeNull();
    expect(result.sales).toEqual([{ currency: "BRL", amountCents: 2100 }]);
    expect(result.topProducts).toEqual([{ title: "Mochila", units: 2 }]);
  });

  it("fails an incomplete pagination instead of sending partial counts", async () => {
    await expect(
      readShopeeMetrics(period, (async () =>
        Response.json({
          data: {
            conversionReport: {
              nodes: [],
              pageInfo: { hasNextPage: true, scrollId: "" },
            },
          },
        })) as typeof fetch),
    ).rejects.toThrow(/paginação/i);
  });
});
