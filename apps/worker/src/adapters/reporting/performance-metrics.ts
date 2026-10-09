import { z } from "zod";
import { marketplaceEnv as env } from "../../config/runtime.js";
import { shopeeAuthorization } from "../sources/shopee.adapter.js";
import {
  addMoney,
  type ReportPeriod,
  type SourceMetrics,
} from "../../domain/performance-report.js";

const numeric = z
  .union([z.number(), z.string().trim().min(1)])
  .pipe(z.coerce.number().finite());
const count = numeric.pipe(z.number().int().nonnegative());
const purchaseTypes = new Set(["Sale", "Mobile Sale", "Mobile App Purchase"]);
const amount = z.object({
  amount: numeric,
  currency: z.string().regex(/^[A-Z]{3}$/),
});
const transactionsSchema = z.array(
  z.object({
    id: z.union([z.string(), z.number()]),
    type: z.string(),
    commissionStatus: z.enum(["pending", "approved", "declined", "deleted"]),
    saleAmount: amount,
    commissionAmount: amount,
    basketProducts: z
      .array(
        z.object({
          productName: z.string().optional(),
          quantity: count.optional(),
        }),
      )
      .nullable()
      .optional(),
  }),
);
const clicksSchema = z.array(z.object({ clicks: count }));

async function json(response: Response, source: string): Promise<unknown> {
  if (!response.ok) throw new Error(`${source}: HTTP ${response.status}`);
  return response.json();
}

function emptyMetrics(source: string, approvalLabel: string): SourceMetrics {
  return {
    source,
    clicks: null,
    orders: { total: 0, approved: 0, pending: 0, cancelled: 0, unpaid: 0 },
    approvalLabel,
    estimatedCommissions: [],
    confirmedCommissions: [],
    sales: [],
    topProducts: [],
    notes: [],
  };
}

export async function readAwinMetrics(
  period: ReportPeriod,
  fetcher: typeof fetch = fetch,
): Promise<SourceMetrics> {
  const publisher = process.env.AWIN_PUBLISHER_ID;
  const token = process.env.AWIN_API_TOKEN;
  if (!publisher || !token) throw new Error("Awin: credenciais ausentes");
  const base = `https://api.awin.com/publishers/${encodeURIComponent(publisher)}`;
  const clicksUrl = new URL(`${base}/reports/advertiser`);
  for (const [key, value] of Object.entries({
    startDate: period.startDate,
    endDate: period.endDate,
    region: "BR",
    timezone: "America/Sao_Paulo",
  }))
    clicksUrl.searchParams.set(key, value);
  const ordersUrl = new URL(`${base}/transactions/`);
  for (const [key, value] of Object.entries({
    startDate: `${period.startDate}T00:00:00`,
    endDate: `${period.endDate}T23:59:59`,
    timezone: "America/Sao_Paulo",
    dateType: "transaction",
    showBasketProducts: "true",
  }))
    ordersUrl.searchParams.set(key, value);
  const get = (url: URL) =>
    fetcher(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(20000),
    }).then((response) => json(response, "Awin"));
  const [clickData, orderData] = await Promise.all([
    get(clicksUrl),
    get(ordersUrl),
  ]);
  const result = emptyMetrics("Awin — lojas parceiras", "aprovadas");
  result.clicks = clicksSchema
    .parse(clickData)
    .reduce((sum, row) => sum + row.clicks, 0);
  const seen = new Set<string>();
  const purchases = z
    .array(z.object({ type: z.string() }).passthrough())
    .parse(orderData)
    .filter((row) => purchaseTypes.has(row.type));
  for (const transaction of transactionsSchema.parse(purchases)) {
    if (seen.has(String(transaction.id))) continue;
    seen.add(String(transaction.id));
    result.orders!.total++;
    const status = transaction.commissionStatus;
    if (status === "declined" || status === "deleted") {
      result.orders!.cancelled++;
      continue;
    }
    result.orders![status === "approved" ? "approved" : "pending"]++;
    addMoney(
      result.sales!,
      transaction.saleAmount.amount,
      transaction.saleAmount.currency,
    );
    addMoney(
      status === "approved"
        ? result.confirmedCommissions!
        : result.estimatedCommissions!,
      transaction.commissionAmount.amount,
      transaction.commissionAmount.currency,
    );
    for (const product of transaction.basketProducts ?? []) {
      if (!product.productName || !product.quantity) continue;
      const row = result.topProducts.find(
        (item) => item.title === product.productName,
      );
      if (row) row.units += product.quantity;
      else
        result.topProducts.push({
          title: product.productName,
          units: product.quantity,
        });
    }
  }
  result.notes.push(
    "Cliques Awin: programas brasileiros em BRL. Compras excluem bônus e pagamentos por clique.",
  );
  return result;
}

const shopeeSchema = z.object({
  data: z.object({
    conversionReport: z.object({
      nodes: z.array(
        z.object({
          orders: z.array(
            z.object({
              orderId: z.union([z.string(), z.number()]),
              orderStatus: z.enum([
                "UNPAID",
                "PENDING",
                "COMPLETED",
                "CANCELLED",
              ]),
              items: z.array(
                z.object({
                  itemName: z.string(),
                  qty: count,
                  itemPrice: numeric.pipe(z.number().nonnegative()),
                  itemTotalCommission: numeric,
                }),
              ),
            }),
          ),
        }),
      ),
      pageInfo: z.object({
        hasNextPage: z.boolean(),
        scrollId: z.string().nullable().optional(),
      }),
    }),
  }),
});

export async function readShopeeMetrics(
  period: ReportPeriod,
  fetcher: typeof fetch = fetch,
): Promise<SourceMetrics> {
  if (!env.SHOPEE_APP_ID || !env.SHOPEE_SECRET || !env.SHOPEE_AFFILIATE_API_URL)
    throw new Error("Shopee: credenciais ausentes");
  const result = emptyMetrics("Shopee", "concluídas");
  result.confirmedCommissions = null;
  const seenOrders = new Set<string>();
  const seenScrolls = new Set<string>();
  let scroll = "";
  for (let page = 0; page < 100; page++) {
    const query = `{ conversionReport(purchaseTimeStart:${Date.parse(period.startIso) / 1000},purchaseTimeEnd:${Date.parse(period.endExclusiveIso) / 1000 - 1},limit:50${scroll ? `,scrollId: ${JSON.stringify(scroll)}` : ""}) {
      nodes { orders { orderId orderStatus items { itemName qty itemPrice itemTotalCommission } } }
      pageInfo { hasNextPage scrollId }
    } }`;
    const body = JSON.stringify({ query });
    const response = await fetcher(env.SHOPEE_AFFILIATE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: shopeeAuthorization(
          env.SHOPEE_APP_ID,
          env.SHOPEE_SECRET,
          body,
          Math.floor(Date.now() / 1000),
        ),
      },
      body,
      signal: AbortSignal.timeout(20000),
    });
    const data = shopeeSchema.parse(await json(response, "Shopee")).data
      .conversionReport;
    for (const node of data.nodes)
      for (const order of node.orders) {
        if (seenOrders.has(String(order.orderId))) continue;
        seenOrders.add(String(order.orderId));
        result.orders!.total++;
        const status = order.orderStatus;
        result.orders![
          status === "COMPLETED"
            ? "approved"
            : status === "PENDING"
              ? "pending"
              : status === "CANCELLED"
                ? "cancelled"
                : "unpaid"
        ]++;
        if (status === "CANCELLED" || status === "UNPAID") continue;
        for (const item of order.items) {
          addMoney(result.sales!, item.itemPrice * item.qty, "BRL");
          addMoney(
            result.estimatedCommissions!,
            item.itemTotalCommission,
            "BRL",
          );
          const row = result.topProducts.find(
            (product) => product.title === item.itemName,
          );
          if (row) row.units += item.qty;
          else
            result.topProducts.push({ title: item.itemName, units: item.qty });
        }
      }
    if (!data.pageInfo.hasNextPage) {
      result.notes.push(
        "API de conversões sem total de cliques; comissões ainda estimadas, inclusive em pedidos concluídos.",
      );
      return result;
    }
    scroll = data.pageInfo.scrollId ?? "";
    if (!scroll || seenScrolls.has(scroll))
      throw new Error("Shopee: paginação incompleta");
    seenScrolls.add(scroll);
  }
  throw new Error("Shopee: limite de paginação atingido; métricas incompletas");
}
