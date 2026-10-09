import { describe, expect, it } from "vitest";
import {
  getReportPeriod,
  formatPerformanceReport,
  type SourceMetrics,
} from "../../src/domain/performance-report.js";

describe("report calendar periods in Sao Paulo", () => {
  it("uses the last completed Monday-to-Sunday week at local midnight", () => {
    expect(getReportPeriod("weekly", new Date("2026-10-05T03:00:00Z"))).toEqual(
      {
        kind: "weekly",
        startDate: "2026-09-28",
        endDate: "2026-10-04",
        startIso: "2026-09-28T03:00:00.000Z",
        endExclusiveIso: "2026-10-05T03:00:00.000Z",
      },
    );
    expect(
      getReportPeriod("weekly", new Date("2026-10-05T02:59:59Z")).startDate,
    ).toBe("2026-09-21");
  });

  it("handles the previous calendar month across years and leap years", () => {
    expect(
      getReportPeriod("monthly", new Date("2027-01-01T12:00:00Z")),
    ).toMatchObject({
      startDate: "2026-12-01",
      endDate: "2026-12-31",
    });
    expect(
      getReportPeriod("monthly", new Date("2024-03-01T12:00:00Z")),
    ).toMatchObject({
      startDate: "2024-02-01",
      endDate: "2024-02-29",
    });
  });
});

describe("report presentation", () => {
  it("distinguishes missing metrics from measured zero and keeps currencies separate", () => {
    const sources: SourceMetrics[] = [
      {
        source: "Awin",
        clicks: 0,
        orders: { total: 0, approved: 0, pending: 0, cancelled: 0, unpaid: 0 },
        approvalLabel: "aprovadas",
        estimatedCommissions: [{ currency: "BRL", amountCents: 27 }],
        confirmedCommissions: [{ currency: "USD", amountCents: 100 }],
        sales: [],
        topProducts: [],
        notes: [],
      },
      {
        source: "Shopee",
        clicks: null,
        orders: null,
        approvalLabel: "concluídos",
        estimatedCommissions: null,
        confirmedCommissions: null,
        sales: null,
        topProducts: [],
        notes: ["API indisponível"],
      },
    ];
    const text = formatPerformanceReport({
      period: getReportPeriod("monthly", new Date("2026-10-09T12:00:00Z")),
      publications: [{ channel: "Moda", count: 2 }],
      sources,
    });
    expect(text).toContain("| Awin | 0 | 0 |");
    expect(text).not.toContain("| Shopee | 0 | 0 |");
    expect(text).toContain("Sem métricas: Shopee");
    expect(text).toContain("0,27");
    expect(text).toContain("US\\$");
    expect(text).toContain("**2** promoções publicadas");
    expect(text.length).toBeLessThanOrEqual(4096);
  });

  it("escapes product titles instead of allowing links or rich markup in a report", () => {
    const text = formatPerformanceReport({
      period: getReportPeriod("weekly", new Date("2026-10-09T12:00:00Z")),
      publications: [],
      sources: [
        {
          source: "Shopee",
          clicks: null,
          orders: {
            total: 1,
            approved: 1,
            pending: 0,
            cancelled: 0,
            unpaid: 0,
          },
          approvalLabel: "concluídas",
          estimatedCommissions: [],
          confirmedCommissions: null,
          sales: [],
          notes: [],
          topProducts: [
            {
              title: "Bolsa [link](https://evil.test) <footer> falsa",
              units: 1,
            },
          ],
        },
      ],
    });
    expect(text).toContain("| Shopee | — | 1 |");
    expect(text).toContain("\\[link\\]");
    expect(text).toContain("&lt;footer&gt;");
    expect(text).not.toContain("[link](https://evil.test)");
  });
});
