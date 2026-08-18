import type { SourceAdapter } from "./source-adapter.js";
import type { DiscoveredProduct, DiscoveryInput } from "./source-adapter.js";
import type { ExtractedProduct } from "../../domain/offer.js";
import type { PriceSnapshot, ProductRef } from "../../domain/price.js";
import type { AffiliateLinkResult } from "../../domain/affiliate-link.js";
import { AppError } from "../../shared/errors.js";
import { resilientFetch } from "../../shared/http-client.js";

const LOMADEE_BASE_URL =
  process.env.LOMADEE_BASE_URL || "https://api.lomadee.com.br";
const LOMADEE_API_KEY = process.env.LOMADEE_API_KEY;
const LOMADEE_CHANNEL_ID = process.env.LOMADEE_CHANNEL_ID;
const LOMADEE_PAGE_LIMIT = Number(process.env.LOMADEE_PAGE_LIMIT) || 100;

interface LomadeeProductOption {
  id: string;
  ean?: string;
  name?: string;
  available?: boolean;
  seller?: string;
  images?: Array<{ url: string }>;
  pricing?: Array<{ listPrice?: number; price?: number }>;
  stocks?: Array<{ value?: number }>;
}

interface LomadeeProduct {
  id: string;
  organizationId: string;
  name: string;
  url: string;
  available?: boolean;
  images?: Array<{ url: string }>;
  options?: LomadeeProductOption[];
  metadata?: Array<{ key?: string; value?: unknown }>;
}

interface LomadeeCampaign {
  id: string;
  organizationId: string;
  name: string;
  type: string;
  code?: string;
  status?: string;
  period?: { endAt?: string };
  isHighlight?: boolean;
}

function metadataNumber(product: LomadeeProduct, key: string): number | null {
  const raw = product.metadata?.find((item) => item.key === key)?.value;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function uniqueImageUrls(product: LomadeeProduct): string[] {
  const urls = [
    ...(product.images ?? []).map((image) => image.url),
    ...(product.options ?? []).flatMap((option) =>
      (option.images ?? []).map((image) => image.url),
    ),
  ];
  return [...new Set(urls)].filter((url) => /^https?:\/\//i.test(url));
}

function selectOption(product: LomadeeProduct): LomadeeProductOption | null {
  return (
    product.options?.find(
      (option) =>
        option.available !== false &&
        option.pricing?.some((price) => Number(price.price) > 0),
    ) ??
    product.options?.find((option) =>
      option.pricing?.some((price) => Number(price.price) > 0),
    ) ??
    null
  );
}

function toCents(value?: number): number | null {
  return value && value > 0 ? Math.round(value * 100) : null;
}

function promotionRank(
  product: LomadeeProduct,
  highlighted: boolean,
): [number, number] {
  const option = selectOption(product);
  const price = toCents(option?.pricing?.[0]?.price) ?? Number.MAX_SAFE_INTEGER;
  const listPrice = toCents(option?.pricing?.[0]?.listPrice);
  const discount =
    listPrice && listPrice > price
      ? ((listPrice - price) / listPrice) * 100
      : 0;
  const likes = Math.max(metadataNumber(product, "likes") ?? 0, 0);
  const rating = Math.max(metadataNumber(product, "item_rating") ?? 0, 0);
  const popularity =
    Math.min(Math.log10(likes + 1) * 8, 30) +
    Math.min(rating * 3, 15) +
    (highlighted ? 10 : 0);
  return [discount + popularity, price];
}

function titleTokens(title: string): Set<string> {
  return new Set(
    title
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(" ")
      .filter((token) => token.length > 2),
  );
}

function titleSimilarity(left: string, right: string): number {
  const a = titleTokens(left);
  const b = titleTokens(right);
  if (a.size === 0 || b.size === 0) return 0;
  const intersection = [...a].filter((token) => b.has(token)).length;
  return intersection / new Set([...a, ...b]).size;
}

export class LomadeeAdapter implements SourceAdapter {
  readonly source = "lomadee";
  private readonly productCache = new Map<string, LomadeeProduct>();
  private readonly campaignCache = new Map<string, LomadeeCampaign>();
  private readonly highlightedOrganizations = new Set<string>();

  private get headers(): Record<string, string> {
    return {
      Accept: "application/json",
      ...(LOMADEE_API_KEY ? { "x-api-key": LOMADEE_API_KEY } : {}),
    };
  }

  private async getJson<T>(path: string): Promise<T> {
    const resp = await resilientFetch(`${LOMADEE_BASE_URL}${path}`, {
      source: this.source,
      headers: this.headers,
    });
    if (resp.status === 429) {
      throw new AppError(
        "SOURCE_RATE_LIMITED",
        `Rate limited. Retry-After: ${resp.headers.get("Retry-After")}`,
        true,
      );
    }
    if (!resp.ok) {
      throw new AppError(
        "SOURCE_UNAVAILABLE",
        `Lomadee API error: ${resp.status} ${resp.statusText}`,
        true,
      );
    }
    return (await resp.json()) as T;
  }

  private async loadCampaigns(): Promise<void> {
    const first = await this.getJson<{
      data?: LomadeeCampaign[];
      meta?: { totalPages?: number };
    }>("/affiliate/campaigns?page=1&limit=20");
    const campaigns = [...(first.data ?? [])];
    const totalPages = Math.min(first.meta?.totalPages ?? 1, 5);
    if (totalPages > 1) {
      const pages = await Promise.all(
        Array.from({ length: totalPages - 1 }, (_, index) =>
          this.getJson<{ data?: LomadeeCampaign[] }>(
            `/affiliate/campaigns?page=${index + 2}&limit=20`,
          ),
        ),
      );
      campaigns.push(...pages.flatMap((page) => page.data ?? []));
    }
    for (const campaign of campaigns) {
      if (campaign.status === "onTime" && campaign.isHighlight) {
        this.highlightedOrganizations.add(campaign.organizationId);
      }
      if (
        campaign.type === "GenericCoupon" &&
        campaign.code &&
        campaign.status === "onTime"
      ) {
        this.campaignCache.set(campaign.organizationId, campaign);
      }
    }
  }

  async discover(input: DiscoveryInput): Promise<DiscoveredProduct[]> {
    if (!LOMADEE_API_KEY) {
      throw new AppError(
        "SOURCE_UNAVAILABLE",
        "Lomadee API key not configured",
        false,
        503,
      );
    }

    const requestedLimit = Math.min(input.limit ?? 20, LOMADEE_PAGE_LIMIT, 100);
    const poolLimit = Math.min(Math.max(requestedLimit * 5, 20), 100);
    const params = new URLSearchParams({
      page: "1",
      limit: String(poolLimit),
      isAvailable: "true",
    });
    if (input.query) params.set("search", input.query);

    const [response] = await Promise.all([
      this.getJson<{ data?: LomadeeProduct[] }>(
        `/affiliate/products?${params.toString()}`,
      ),
      this.loadCampaigns(),
    ]);

    const ranked = [...(response.data ?? [])].sort((left, right) => {
      const [leftRank, leftPrice] = promotionRank(
        left,
        this.highlightedOrganizations.has(left.organizationId),
      );
      const [rightRank, rightPrice] = promotionRank(
        right,
        this.highlightedOrganizations.has(right.organizationId),
      );
      return rightRank - leftRank || leftPrice - rightPrice;
    });
    const selected: LomadeeProduct[] = [];
    for (const product of ranked) {
      if (
        selected.some(
          (existing) => titleSimilarity(existing.name, product.name) >= 0.85,
        )
      ) {
        continue;
      }
      selected.push(product);
    }

    return selected.map((product) => {
      this.productCache.set(product.url, product);
      return {
        externalId: product.id,
        canonicalUrl: product.url,
        title: product.name,
      };
    });
  }

  async extract({ url }: { url: URL }): Promise<ExtractedProduct> {
    const product = this.productCache.get(url.toString());
    if (!product) {
      throw new AppError(
        "SOURCE_SELECTOR_NOT_FOUND",
        "Lomadee product is not present in the current discovery batch",
        true,
      );
    }

    const option = selectOption(product);
    const pricing = option?.pricing?.[0];
    const currentPriceCents = toCents(pricing?.price) ?? 0;
    const listPriceCents = toCents(pricing?.listPrice);
    const previousPriceCents =
      listPriceCents && listPriceCents > currentPriceCents
        ? listPriceCents
        : null;
    if (currentPriceCents <= 0) {
      throw new AppError(
        "SOURCE_SELECTOR_NOT_FOUND",
        "Product has no valid price",
        true,
      );
    }

    const images = uniqueImageUrls(product);
    const campaign = this.campaignCache.get(product.organizationId);
    const likes = Math.max(metadataNumber(product, "likes") ?? 0, 0);
    const itemRating = metadataNumber(product, "item_rating");
    const shopRating = metadataNumber(product, "shop_rating");
    const inStock =
      product.available !== false &&
      option?.available !== false &&
      (option?.stocks?.some((stock) => Number(stock.value) > 0) ?? true);

    return {
      source: this.source,
      externalId: product.id,
      canonicalUrl: product.url,
      title: option?.name || product.name,
      currentPriceCents,
      previousPriceCents,
      currency: "BRL",
      imageUrl: images[0] ?? null,
      availability: inStock ? "in_stock" : "out_of_stock",
      seller: option?.seller ?? null,
      rating: itemRating !== null ? Math.min(Math.max(itemRating, 0), 5) : null,
      reviewCount: null,
      capturedAt: new Date().toISOString(),
      rawEvidence: {
        organizationId: product.organizationId,
        additionalImageUrls: images.slice(1, 10),
        ean: option?.ean ?? null,
        couponCode: campaign?.code ?? null,
        couponDescription: campaign?.name ?? null,
        couponExpiresAt: campaign?.period?.endAt ?? null,
        likes,
        shopRating,
        highlightedCampaign: this.highlightedOrganizations.has(
          product.organizationId,
        ),
        source: "lomadee_api",
      },
    };
  }

  async revalidate(product: ProductRef): Promise<PriceSnapshot> {
    const response = await this.discover({
      query: product.externalId,
      limit: 20,
    });
    const match = response.find(
      (item) =>
        item.externalId === product.externalId ||
        item.canonicalUrl === product.canonicalUrl,
    );
    if (!match) {
      throw new AppError(
        "SOURCE_SELECTOR_NOT_FOUND",
        "Product was not found during Lomadee revalidation",
        true,
      );
    }
    const extracted = await this.extract({ url: new URL(match.canonicalUrl) });
    return {
      currentPriceCents: extracted.currentPriceCents,
      previousPriceCents: extracted.previousPriceCents ?? null,
      currency: extracted.currency,
      availability: extracted.availability,
      capturedAt: extracted.capturedAt,
    };
  }

  async createAffiliateLink(url: URL): Promise<AffiliateLinkResult> {
    const product = this.productCache.get(url.toString());
    if (!product) {
      return { status: "unsupported", reason: "Product context not found" };
    }

    try {
      const resp = await resilientFetch(
        `${LOMADEE_BASE_URL}/affiliate/shortener/url`,
        {
          source: this.source,
          method: "POST",
          headers: { ...this.headers, "Content-Type": "application/json" },
          body: JSON.stringify({
            organizationId: product.organizationId,
            type: "Custom",
            url: product.url,
          }),
        },
      );
      if (!resp.ok) return { status: "session_expired" };

      const data = (await resp.json()) as Array<{
        id?: string;
        shortUrls?: string[];
      }>;
      const selected =
        data.find((channel) => channel.id === LOMADEE_CHANNEL_ID) ?? data[0];
      const affiliateUrl = selected?.shortUrls?.[0];
      return affiliateUrl
        ? { status: "generated", url: affiliateUrl }
        : { status: "session_expired" };
    } catch {
      return { status: "session_expired" };
    }
  }

  async healthCheck() {
    if (!LOMADEE_API_KEY) {
      return {
        healthy: false,
        details: { reason: "API key not configured" },
      };
    }
    try {
      const response = await this.getJson<{ data?: unknown[]; count?: number }>(
        "/affiliate/channels",
      );
      const channels = response.data ?? [];
      const configuredChannelFound = LOMADEE_CHANNEL_ID
        ? channels.some(
            (channel) =>
              typeof channel === "object" &&
              channel !== null &&
              "id" in channel &&
              String(channel.id) === LOMADEE_CHANNEL_ID,
          )
        : true;
      return {
        healthy: channels.length > 0,
        details: {
          source: this.source,
          channelCount: response.count ?? channels.length,
          configuredChannelFound,
        },
      };
    } catch (error) {
      return {
        healthy: false,
        details: {
          source: this.source,
          error: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }
}
