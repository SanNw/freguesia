import { readFile } from "node:fs/promises";

export interface AwinFeedProduct {
  externalId: string;
  productUrl: string;
  affiliateUrl: string;
  title: string;
  currentPriceCents: number;
  previousPriceCents: number | null;
  currency: string;
  imageUrl: string | null;
  category: string | null;
  brand: string | null;
  merchantName: string | null;
  availability: "in_stock" | "out_of_stock";
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function cents(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

export function normalizeProductUrl(value: string): string {
  const url = new URL(value);
  const kabumProductId = url.pathname.match(/\/produto\/(\d+)/)?.[1];
  if (kabumProductId) return `${url.hostname}/produto/${kabumProductId}`;
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

export const FEED_POOL_SIZE = 500;

function discountShare(product: AwinFeedProduct): number {
  if (!product.previousPriceCents || product.previousPriceCents <= 0) {
    return -1;
  }
  return (product.previousPriceCents - product.currentPriceCents) / product.previousPriceCents;
}

export function selectFeedOffers(
  products: AwinFeedProduct[],
  opts: { query?: string; poolSize?: number } = {},
): AwinFeedProduct[] {
  const poolSize = opts.poolSize ?? FEED_POOL_SIZE;
  const query = opts.query?.trim().toLowerCase();

  const eligible = [...products]
    .filter((p) => {
      if (p.availability !== "in_stock") return false;
      if (p.currentPriceCents <= 0) return false;
      if (p.currency !== "BRL") return false;
      if (!p.imageUrl) return false;
      if (!p.productUrl) return false;
      if (!p.affiliateUrl) return false;
      if (query && !p.title.toLowerCase().includes(query)) return false;
      return true;
    })
    .sort((a, b) => discountShare(b) - discountShare(a));

  const byMerchant = new Map<string, AwinFeedProduct[]>();
  for (const product of eligible) {
    const merchant = product.merchantName || "Awin";
    const items = byMerchant.get(merchant);
    if (items) items.push(product);
    else byMerchant.set(merchant, [product]);
  }

  const selected: AwinFeedProduct[] = [];
  while (selected.length < poolSize && [...byMerchant.values()].some((items) => items.length)) {
    for (const items of byMerchant.values()) {
      const product = items.shift();
      if (product) selected.push(product);
      if (selected.length === poolSize) break;
    }
  }
  return selected;
}

export async function loadAwinFeed(
  path = process.env.AWIN_FEED_PATH,
): Promise<AwinFeedProduct[]> {
  if (!path) throw new Error("AWIN_FEED_PATH is not configured");
  const paths = path.split(",").map((value) => value.trim()).filter(Boolean);
  const feeds = await Promise.all(paths.map((feedPath) => readFile(feedPath, "utf8")));
  return feeds.flatMap(parseAwinFeed);
}

function parseAwinFeed(text: string): AwinFeedProduct[] {
  const rows = parseCsv(text);
  const headers = rows.shift() ?? [];
  const index = Object.fromEntries(headers.map((header, i) => [header, i]));
  const products: AwinFeedProduct[] = [];

  for (const row of rows) {
    const get = (name: string) => row[index[name]] ?? "";
    const productUrl = get("merchant_deep_link");
    const currentPriceCents = cents(get("search_price"));
    if (!productUrl || currentPriceCents <= 0) continue;
    const oldPrice = Math.max(
      cents(get("rrp_price")),
      cents(get("product_price_old")),
      cents(get("store_price")),
    );
    products.push({
      externalId: get("aw_product_id") || get("merchant_product_id"),
      productUrl,
      affiliateUrl: get("aw_deep_link"),
      title: get("product_name"),
      currentPriceCents,
      previousPriceCents: oldPrice > currentPriceCents ? oldPrice : null,
      currency: get("currency") || "BRL",
      imageUrl:
        (get("merchant_image_url") || get("aw_image_url")).replace(
          /^http:/,
          "https:",
        ) || null,
      category: get("merchant_category") || null,
      brand: get("brand_name") || null,
      merchantName: get("merchant_name") || null,
      availability:
        get("in_stock") !== "0" && get("is_for_sale") !== "0"
          ? "in_stock"
          : "out_of_stock",
    });
  }
  return products;
}
