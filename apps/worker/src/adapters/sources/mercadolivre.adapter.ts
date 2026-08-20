import type { ExtractedProduct } from "../../domain/offer.js";
import type { PriceSnapshot, ProductRef } from "../../domain/price.js";
import type { AffiliateLinkResult } from "../../domain/affiliate-link.js";
import { mercadoLivreEnv as env } from "../../config/runtime.js";
import { AppError } from "../../shared/errors.js";
import { resilientFetch } from "../../shared/http-client.js";
import { getMercadoLivreAccessToken } from "../mercadolivre/oauth.js";
import type {
  DiscoveredProduct,
  DiscoveryInput,
  SourceAdapter,
} from "./source-adapter.js";

interface SearchResult {
  id: string;
  title: string;
  permalink: string;
  price?: number;
  original_price?: number | null;
  currency_id?: string;
  available_quantity?: number;
  thumbnail?: string;
  seller?: { id?: number; nickname?: string };
  attributes?: Array<{ id: string; value_name?: string | null }>;
  installments?: { quantity?: number; amount?: number; rate?: number } | null;
}

interface CatalogProduct {
  id: string;
  name: string;
  status?: string;
  pictures?: Array<{ url?: string }>;
  attributes?: Array<{ id: string; value_name?: string | null }>;
}

interface CatalogSearchResponse {
  results?: CatalogProduct[];
}

interface CatalogItem {
  item_id: string;
  seller_id?: number;
  price: number;
  original_price?: number | null;
  currency_id: string;
  condition?: string;
  tags?: string[];
  shipping?: { free_shipping?: boolean };
  installments?: { quantity?: number; amount?: number; rate?: number } | null;
}

interface CatalogItemsResponse {
  results?: CatalogItem[];
}

function itemIdFromUrl(url: URL): string | null {
  return (
    url
      .toString()
      .match(/MLB-?\d+/i)?.[0]
      .replace("-", "")
      .toUpperCase() ?? null
  );
}

function cents(value: number | null | undefined): number | null {
  return value == null || !Number.isFinite(value)
    ? null
    : Math.round(value * 100);
}

export class MercadoLivreAdapter implements SourceAdapter {
  readonly source = "mercadolivre";
  private readonly cache = new Map<string, SearchResult>();

  private async api<T>(path: string): Promise<T> {
    const token = await getMercadoLivreAccessToken();
    const response = await resilientFetch(
      `${env.MERCADOLIVRE_API_BASE_URL}${path}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        source: "mercadolivre-api",
      },
    );
    if (!response.ok) {
      const detail = await response.text();
      throw new AppError(
        response.status === 401 || response.status === 403
          ? "SOURCE_AUTH_REQUIRED"
          : "SOURCE_UNAVAILABLE",
        `Mercado Livre API error ${response.status}: ${detail.slice(0, 200)}`,
        response.status >= 500 || response.status === 429,
        response.status,
      );
    }
    return (await response.json()) as T;
  }

  async discover(input: DiscoveryInput): Promise<DiscoveredProduct[]> {
    const limit = Math.min(input.limit ?? 20, 50);
    const products = input.category
      ? await this.productsFromHighlights(input.category, limit * 3)
      : await this.searchCatalogProducts(
          input.query ?? "smartphone",
          limit * 3,
        );
    const candidates: SearchResult[] = [];

    for (const product of products) {
      if (candidates.length >= limit) break;
      let items: CatalogItemsResponse;
      try {
        items = await this.api<CatalogItemsResponse>(
          `/products/${product.id}/items`,
        );
      } catch (error) {
        if (error instanceof AppError && error.statusCode === 404) continue;
        throw error;
      }
      const promotional = (items.results ?? [])
        .filter(
          (item) =>
            item.condition !== "used" &&
            item.original_price != null &&
            item.original_price > item.price,
        )
        .sort((left, right) => {
          const leftDiscount =
            (Number(left.original_price) - left.price) /
            Number(left.original_price);
          const rightDiscount =
            (Number(right.original_price) - right.price) /
            Number(right.original_price);
          return rightDiscount - leftDiscount || left.price - right.price;
        });
      const item = promotional[0];
      if (!item) continue;
      const digits = item.item_id.replace(/^MLB/i, "");
      const permalink = `https://produto.mercadolivre.com.br/MLB-${digits}?catalog_product_id=${product.id}`;
      const candidate: SearchResult = {
        id: item.item_id,
        title: product.name,
        permalink,
        price: item.price,
        original_price: item.original_price,
        currency_id: item.currency_id,
        available_quantity: 1,
        thumbnail: product.pictures?.[0]?.url,
        seller: { id: item.seller_id },
        attributes: product.attributes,
        installments: item.installments,
      };
      this.cache.set(candidate.id, candidate);
      candidates.push(candidate);
    }
    return candidates.map((item) => ({
      externalId: item.id,
      canonicalUrl: item.permalink,
      title: item.title,
    }));
  }

  private async searchCatalogProducts(
    query: string,
    limit: number,
  ): Promise<CatalogProduct[]> {
    const params = new URLSearchParams({
      site_id: "MLB",
      q: query,
      status: "active",
      limit: String(Math.min(limit, 50)),
    });
    const data = await this.api<CatalogSearchResponse>(
      `/products/search?${params.toString()}`,
    );
    return (data.results ?? []).filter(
      (product) => product.id && product.name && product.status !== "inactive",
    );
  }

  private async productsFromHighlights(
    category: string,
    limit: number,
  ): Promise<CatalogProduct[]> {
    const highlights = await this.api<{
      content?: Array<{ id: string; type: string }>;
    }>(`/highlights/MLB/category/${encodeURIComponent(category)}`);
    const ids = (highlights.content ?? [])
      .filter((entry) => entry.type === "PRODUCT")
      .slice(0, limit)
      .map((entry) => entry.id);
    const products: CatalogProduct[] = [];
    for (const id of ids) {
      products.push(await this.api<CatalogProduct>(`/products/${id}`));
    }
    return products;
  }

  async extract({ url }: { url: URL }): Promise<ExtractedProduct> {
    const id = itemIdFromUrl(url);
    if (!id) {
      throw new AppError(
        "VALIDATION_FAILED",
        "Mercado Livre item ID was not found in URL",
        false,
        400,
      );
    }
    const item = this.cache.get(id);
    if (!item) {
      throw new AppError(
        "SOURCE_UNAVAILABLE",
        "Mercado Livre item must be extracted from an official catalog discovery",
        false,
        409,
      );
    }
    const currentPriceCents = cents(item.price);
    if (!currentPriceCents) {
      throw new AppError(
        "SOURCE_UNAVAILABLE",
        "Mercado Livre returned an invalid sale price",
        true,
      );
    }
    const imageUrl = item.thumbnail?.replace(/^http:/, "https:") ?? null;
    const gtin = item.attributes?.find((attribute) =>
      ["GTIN", "EAN"].includes(attribute.id),
    )?.value_name;

    return {
      source: this.source,
      externalId: id,
      canonicalUrl: item.permalink || url.toString(),
      title: item.title,
      currentPriceCents,
      previousPriceCents: cents(item.original_price),
      currency: item.currency_id || "BRL",
      imageUrl,
      availability:
        item.available_quantity != null && item.available_quantity <= 0
          ? "out_of_stock"
          : "in_stock",
      seller: item.seller?.nickname ?? null,
      rating: null,
      reviewCount: null,
      capturedAt: new Date().toISOString(),
      rawEvidence: {
        api: "mercadolibre",
        sellerId: item.seller?.id ?? null,
        gtin: gtin ?? null,
        installmentCount: item.installments?.quantity ?? null,
        installmentValueCents: cents(item.installments?.amount),
        interestFree: item.installments?.rate === 0,
      },
    };
  }

  async revalidate(product: ProductRef): Promise<PriceSnapshot> {
    const extracted = await this.extract({
      url: new URL(product.canonicalUrl),
    });
    return {
      currentPriceCents: extracted.currentPriceCents,
      previousPriceCents: extracted.previousPriceCents ?? null,
      currency: extracted.currency,
      availability: extracted.availability,
      capturedAt: extracted.capturedAt,
    };
  }

  async createAffiliateLink(): Promise<AffiliateLinkResult> {
    return {
      status: "manual_required",
      reason: "Use the official Mercado Livre Affiliate Portal link generator",
    };
  }

  async healthCheck() {
    if (!env.SOURCE_MERCADOLIVRE_ENABLED) {
      return { healthy: false, details: { reason: "disabled_by_config" } };
    }
    try {
      const user = await this.api<{ id: number }>("/users/me");
      return { healthy: true, details: { userId: String(user.id) } };
    } catch (error) {
      return {
        healthy: false,
        details: {
          error: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }
}
