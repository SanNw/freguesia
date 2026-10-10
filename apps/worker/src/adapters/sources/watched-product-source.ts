import { marketplaceEnv } from "../../config/runtime.js";
import {
  parseProductIdentity,
  safeProductUrl,
  type ProductIdentity,
} from "../../domain/product-watch.js";
import {
  productWatchRepository,
  type CatalogWatchRow,
  type ProductWatchRepository,
} from "../persistence/product-watch-repository.js";
import { shopeeAuthorization } from "./shopee.adapter.js";

export interface WatchOffer {
  identity: ProductIdentity;
  offerId: string | null;
  title: string;
  affiliateUrl: string;
  priceCents: number;
  coupon: string | null;
  availability: "in_stock" | "unknown";
  isCurrent?: boolean;
}
type Config = Pick<
  typeof marketplaceEnv,
  | "SOURCE_SHOPEE_ENABLED"
  | "SHOPEE_AFFILIATE_API_URL"
  | "SHOPEE_APP_ID"
  | "SHOPEE_SECRET"
>;
interface ShopeeNode {
  itemId?: string | number;
  shopId?: string | number;
  productName?: string;
  productLink?: string;
  priceMin?: string;
  priceMax?: string;
  periodStartTime?: number;
  periodEndTime?: number;
  stock?: number;
  availability?: string;
}
interface ShopeeResponse {
  errors?: unknown[];
  data?: {
    productOfferV2?: { nodes?: ShopeeNode[] };
    generateShortLink?: { shortLink?: string };
  };
}

export function validWatchAffiliate(url: string): boolean {
  const parsed = safeProductUrl(url);
  if (!parsed) return false;
  return [
    "shopee.com.br",
    "s.shopee.com.br",
    "shope.ee",
    "amzn.to",
    "a.co",
    "amazon.com.br",
    "www.amazon.com.br",
    "mercadolivre.com",
    "mercadolivre.com.br",
    "www.mercadolivre.com.br",
    "produto.mercadolivre.com.br",
    "meli.la",
    "kabum.com.br",
    "www.kabum.com.br",
    "aliexpress.com",
    "www.aliexpress.com",
    "pt.aliexpress.com",
    "s.click.aliexpress.com",
    "a.aliexpress.com",
    "awin1.com",
    "www.awin1.com",
    "tidd.ly",
    "redir.lomadee.com",
  ].includes(parsed.hostname);
}
function fromCatalog(row: CatalogWatchRow): WatchOffer | null {
  const identity = parseProductIdentity(row.canonical_url);
  const priceCents = Number(row.current_price_cents);
  if (
    !identity ||
    !Number.isSafeInteger(priceCents) ||
    priceCents <= 0 ||
    !row.affiliate_provider ||
    !validWatchAffiliate(row.affiliate_url)
  )
    return null;
  return {
    identity,
    offerId: row.offer_id,
    title: row.title,
    affiliateUrl: row.affiliate_url,
    priceCents,
    coupon: row.coupon_code ?? null,
    availability: "in_stock",
    isCurrent: row.is_current ?? true,
  };
}

export class WatchedProductSource {
  constructor(
    private readonly repository: Pick<
      ProductWatchRepository,
      "publishedOffer" | "catalogCandidates"
    > = productWatchRepository,
    private readonly config: Config = marketplaceEnv,
    private readonly fetcher: (
      url: string,
      options: RequestInit,
    ) => Promise<Response> = fetch,
  ) {}
  async publicOffer(id: string): Promise<WatchOffer | null> {
    const row = await this.repository.publishedOffer(id);
    return row ? fromCatalog(row) : null;
  }
  async catalog(identity: ProductIdentity): Promise<WatchOffer | null> {
    const candidates = (
      await this.repository.catalogCandidates(identity)
    ).flatMap((row) => {
      const offer = fromCatalog(row);
      return offer?.identity.key === identity.key ? [offer] : [];
    });
    return candidates[0] ?? null;
  }
  private async api(query: string): Promise<ShopeeResponse> {
    const payload = JSON.stringify({ query });
    const response = await this.fetcher(this.config.SHOPEE_AFFILIATE_API_URL, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(8000),
      headers: {
        "Content-Type": "application/json",
        Authorization: shopeeAuthorization(
          this.config.SHOPEE_APP_ID,
          this.config.SHOPEE_SECRET,
          payload,
          Math.floor(Date.now() / 1000),
        ),
      },
      body: payload,
    });
    if (!response.ok)
      throw new Error(`Consulta Shopee indisponível: HTTP ${response.status}.`);
    const result = (await response.json()) as ShopeeResponse;
    if (result.errors?.length)
      throw new Error(
        "Consulta Shopee indisponível: resposta GraphQL recusada.",
      );
    return result;
  }
  async check(identity: ProductIdentity): Promise<WatchOffer | null> {
    const catalog = await this.catalog(identity);
    try {
      const direct = await this.direct(identity);
      // A successful live lookup supersedes historical observations, even
      // when the current price has increased. Otherwise we invent a discount.
      if (direct) return direct;
    } catch (error) {
      if (!catalog) throw error;
    }
    return catalog;
  }
  private async direct(identity: ProductIdentity): Promise<WatchOffer | null> {
    const config = this.config;
    if (
      identity.store !== "shopee" ||
      identity.variantId ||
      !/^\d+$/.test(identity.itemId) ||
      !/^\d+$/.test(identity.shopId ?? "") ||
      !config.SOURCE_SHOPEE_ENABLED ||
      !config.SHOPEE_APP_ID ||
      !config.SHOPEE_SECRET ||
      !config.SHOPEE_AFFILIATE_API_URL
    )
      return null;
    const response = await this.api(
      `{ productOfferV2(itemId: ${identity.itemId}, shopId: ${identity.shopId}, limit: 1) { nodes { itemId shopId productName productLink priceMin priceMax periodStartTime periodEndTime } } }`,
    );
    const product = response.data?.productOfferV2?.nodes?.find(
      (node) =>
        (typeof node.itemId !== "number" ||
          Number.isSafeInteger(node.itemId)) &&
        (typeof node.shopId !== "number" ||
          Number.isSafeInteger(node.shopId)) &&
        String(node.itemId) === identity.itemId &&
        String(node.shopId) === identity.shopId,
    );
    if (
      !product ||
      !product.productLink ||
      parseProductIdentity(product.productLink)?.key !== identity.key
    )
      return null;
    const min = Number(product.priceMin),
      max = Number(product.priceMax);
    const priceCents = Math.round(min * 100),
      now = Math.floor(Date.now() / 1000);
    if (
      !Number.isFinite(min) ||
      !Number.isFinite(max) ||
      min !== max ||
      !Number.isSafeInteger(priceCents) ||
      priceCents <= 0 ||
      !Number.isFinite(product.periodStartTime) ||
      !Number.isFinite(product.periodEndTime) ||
      product.periodStartTime! > now ||
      product.periodEndTime! <= now ||
      product.stock === 0 ||
      product.availability === "out_of_stock"
    )
      return null;
    const link = await this.api(
      `mutation { generateShortLink(input: { originUrl: ${JSON.stringify(identity.canonicalUrl)}, subIds: ["freguesia"] }) { shortLink } }`,
    );
    const affiliateUrl = link.data?.generateShortLink?.shortLink;
    if (!affiliateUrl || !validWatchAffiliate(affiliateUrl)) return null;
    return {
      identity,
      offerId: null,
      title: product.productName || `Shopee ${identity.itemId}`,
      priceCents,
      coupon: null,
      affiliateUrl,
      availability: "unknown",
    };
  }
}
export const watchedProductSource = new WatchedProductSource();
