export type ReportKind = "weekly" | "monthly";
export interface ReportPeriod {
  kind: ReportKind;
  startDate: string;
  endDate: string;
  startIso: string;
  endExclusiveIso: string;
}
export interface Money {
  currency: string;
  amountCents: number;
}
export interface SourceMetrics {
  source: string;
  clicks: number | null;
  orders: {
    total: number;
    approved: number;
    pending: number;
    cancelled: number;
    unpaid: number;
  } | null;
  approvalLabel: string;
  estimatedCommissions: Money[] | null;
  confirmedCommissions: Money[] | null;
  sales: Money[] | null;
  topProducts: Array<{ title: string; units: number }>;
  notes: string[];
}
export interface PerformanceReport {
  period: ReportPeriod;
  publications: Array<{ channel: string; count: number }>;
  sources: SourceMetrics[];
  previous?: {
    publications: Array<{ channel: string; count: number }>;
    sources: SourceMetrics[];
  };
}

const dayMs = 86_400_000;
function dateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function getReportPeriod(
  kind: ReportKind,
  now = new Date(),
): ReportPeriod {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const local = (type: string) =>
    parts.find((part) => part.type === type)!.value;
  const today = new Date(
    `${local("year")}-${local("month")}-${local("day")}T12:00:00Z`,
  );
  let start: Date;
  let end: Date;
  if (kind === "weekly") {
    end = new Date(today.getTime() - ((today.getUTCDay() + 6) % 7) * dayMs);
    start = new Date(end.getTime() - 7 * dayMs);
  } else {
    end = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1, 12),
    );
    start = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1, 12),
    );
  }
  const startDate = dateString(start);
  const endDate = dateString(new Date(end.getTime() - dayMs));
  // Brazil's reports use Sao Paulo calendar days, currently UTC-03:00.
  return {
    kind,
    startDate,
    endDate,
    startIso: new Date(`${startDate}T00:00:00-03:00`).toISOString(),
    endExclusiveIso: new Date(
      `${dateString(end)}T00:00:00-03:00`,
    ).toISOString(),
  };
}

export function unavailableMetrics(
  source: string,
  note: string,
): SourceMetrics {
  return {
    source,
    clicks: null,
    orders: null,
    approvalLabel: "aprovadas",
    estimatedCommissions: null,
    confirmedCommissions: null,
    sales: null,
    topProducts: [],
    notes: [note],
  };
}

export function addMoney(
  totals: Money[],
  amount: number,
  currency: string,
): void {
  const row = totals.find((entry) => entry.currency === currency);
  const cents = Math.round(amount * 100);
  if (row) row.amountCents += cents;
  else totals.push({ currency, amountCents: cents });
}

function moneyText(values: Money[] | null): string {
  if (values === null) return "—";
  if (!values.length) return "R$ 0,00";
  return values
    .map(({ currency, amountCents }) =>
      new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency,
      }).format(amountCents / 100),
    )
    .join(" / ");
}

function comparison(current: number, previous: number | undefined): string {
  if (previous === undefined) return "";
  const diff = current - previous;
  if (diff === 0) return "";
  const sign = diff > 0 ? "+" : "";
  return previous === 0
    ? ` (${sign}${diff} sobre o anterior)`
    : ` (${sign}${Math.round((diff / previous) * 100)}% sobre o anterior)`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function richText(value: string): string {
  return escapeHtml(value).replace(/([\\`*_{}[\]()#+.!|$~=-])/g, "\\$1");
}

export function formatPerformanceReport(report: PerformanceReport): string {
  const date = (value: string) => value.split("-").reverse().join("/");
  const total = report.publications.reduce((sum, row) => sum + row.count, 0);
  const previousTotal = report.previous?.publications.reduce(
    (sum, row) => sum + row.count,
    0,
  );
  const available = report.sources.filter(
    (source) => source.clicks !== null || source.orders !== null,
  );
  const unavailable = report.sources.filter(
    (source) => source.clicks === null && source.orders === null,
  );
  const name = (source: SourceMetrics) => source.source.split(" — ")[0];
  const lines = [
    "# 📊 Freguesia",
    "",
    `**Relatório ${report.period.kind === "weekly" ? "semanal" : "mensal"}**`,
    "",
    `${date(report.period.startDate)} a ${date(report.period.endDate)} · Brasília`,
    "",
    `**${total}** promoções publicadas${comparison(total, previousTotal)}`,
    "",
  ];
  if (available.length) {
    lines.push(
      "## 🛍 Resultados",
      "",
      "| Plataforma | Cliques | Compras |",
      "| --- | ---: | ---: |",
    );
    for (const source of available) {
      lines.push(
        `| ${richText(name(source))} | ${source.clicks ?? "—"} | ${source.orders?.total ?? "—"} |`,
      );
    }
    lines.push(
      "",
      "## 💰 Comissões",
      "",
      "| Plataforma | Estimada | Confirmada |",
      "| --- | ---: | ---: |",
    );
    for (const source of available) {
      lines.push(
        `| ${richText(name(source))} | ${richText(moneyText(source.estimatedCommissions))} | ${richText(moneyText(source.confirmedCommissions))} |`,
      );
    }
    for (const source of available) {
      const orders = source.orders;
      const status: string[] = [];
      if (orders) {
        for (const [count, label] of [
          [orders.approved, source.approvalLabel],
          [orders.pending, "pendentes"],
          [orders.cancelled, "canceladas"],
          [orders.unpaid, "aguardando pagamento"],
        ] as const) {
          if (count)
            status.push(
              `**${count} ${count === 1 ? label.replace(/s$/, "") : label}**`,
            );
        }
      }
      if (status.length)
        lines.push("", `**${richText(name(source))}:** ${status.join(" · ")}`);
      if (source.sales?.some((row) => row.amountCents !== 0)) {
        lines.push(
          `Valor das compras ativas: **${richText(moneyText(source.sales))}**`,
        );
      }
      const previous = report.previous?.sources.find(
        (row) => row.source === source.source,
      );
      const change = [
        source.clicks === null
          ? ""
          : comparison(source.clicks, previous?.clicks ?? undefined),
        orders === null
          ? ""
          : comparison(orders.total, previous?.orders?.total),
      ];
      const changes = [
        change[0] ? `cliques${change[0]}` : "",
        change[1] ? `compras${change[1]}` : "",
      ].filter(Boolean);
      if (changes.length)
        lines.push(
          "",
          `*${richText(name(source))} vs período anterior: ${richText(changes.join(" · "))}*`,
        );
    }
  } else
    lines.push("Métricas de cliques e compras indisponíveis neste momento.");
  if (report.publications.length) {
    lines.push(
      "",
      "## 📣 Por canal",
      "",
      "| Canal | Promoções |",
      "| --- | ---: |",
    );
    for (const row of report.publications)
      lines.push(`| ${richText(row.channel)} | ${row.count} |`);
  }
  const products = available
    .flatMap((source) =>
      source.topProducts.map((item) => ({ ...item, source: name(source) })),
    )
    .sort((a, b) => b.units - a.units)
    .slice(0, 3);
  if (products.length) {
    lines.push("", "## 🏆 Mais vendidos", "");
    for (const item of products) {
      const title = Array.from(item.title.replace(/\s+/g, " "))
        .slice(0, 65)
        .join("");
      lines.push(
        `- ${richText(title)} — **${item.units} un.** · ${richText(item.source)}`,
      );
    }
  }
  const notes = [
    "— = dado não disponível. Compras incluem todos os status acima; comissão confirmada não significa pagamento recebido.",
  ];
  if (unavailable.length)
    notes.push(`Sem métricas: ${unavailable.map(name).join(", ")}.`);
  if (available.some((source) => name(source) === "Shopee"))
    notes.push("Shopee: sem total de cliques; comissões ainda estimadas.");
  if (available.some((source) => name(source) === "Awin"))
    notes.push("Cliques Awin: programas brasileiros em BRL.");
  notes.push(
    "Dados das contas afiliadas, inclusive divulgação fora do bot. Pendentes podem mudar após validação.",
  );
  lines.push("", `<footer>${escapeHtml(notes.join(" "))}</footer>`);
  return lines.join("\n");
}
