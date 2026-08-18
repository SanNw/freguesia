import { createHmac } from "node:crypto";
import type { ExtractedProduct } from "../../domain/offer.js";
import type { PriceSnapshot, ProductRef } from "../../domain/price.js";
import type { AffiliateLinkResult } from "../../domain/affiliate-link.js";
import { env } from "../../config/env.js";
import { AppError } from "../../shared/errors.js";
import { resilientFetch } from "../../shared/http-client.js";
import type {
  AdapterHealth,
  DiscoveredProduct,
  DiscoveryInput,
  ExtractedProductInput,
  SourceAdapter,
} from "./source-adapter.js";

type AliProduct = Record<string, unknown>;
export type AliExpressReadinessReason = "disabled" | "credentials_missing";

export function aliExpressReadiness(config: {
  enabled: boolean;
  apiUrl: string;
  appKey: string;
  secret: string;
  trackingId: string;
}) {
  if (!config.enabled)
    return { ready: false as const, reason: "disabled" as const };
  if (
    !config.apiUrl ||
    !config.appKey ||
    !config.secret ||
    !config.trackingId
  ) {
    return { ready: false as const, reason: "credentials_missing" as const };
  }
  return { ready: true as const };
}

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asCents(value: unknown): number | null {
  const parsed = asNumber(value);
  return parsed != null && parsed > 0 ? Math.round(parsed * 100) : null;
}

function rating(value: unknown): number | null {
  const raw = asText(value);
  if (!raw) return null;
  const percent = Number(raw.replace("%", "").replace(",", "."));
  return Number.isFinite(percent)
    ? Math.min(5, Math.max(0, percent / 20))
    : null;
}

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function isAliExpressQueryMatch(title: string, query?: string): boolean {
  if (!query?.trim()) return true;
  const titleText = normalizeSearchText(title);
  const tokens = normalizeSearchText(query)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3);
  return (
    tokens.length === 0 || tokens.every((token) => titleText.includes(token))
  );
}

function origin(product: AliProduct): "brazil" | "international" {
  const value = (
    asText(product.ship_from_country) ??
    asText(product.product_ship_from_country) ??
    ""
  ).toLowerCase();
  return /(^|\b)(br|brazil|brasil)(\b|$)/i.test(value)
    ? "brazil"
    : "international";
}

export function preferNationalCandidates<T>(
  candidates: T[],
  getOrigin: (candidate: T) => "brazil" | "international",
): T[] {
  const national = candidates.filter(
    (candidate) => getOrigin(candidate) === "brazil",
  );
  return national.length > 0 ? national : candidates;
}

function productsFrom(payload: Record<string, unknown>): AliProduct[] {
  const response = Object.entries(payload).find(([key]) =>
    key.endsWith("_response"),
  )?.[1] as Record<string, unknown> | undefined;
  const respResult = response?.resp_result as
    Record<string, unknown> | undefined;
  const result = respResult?.result as Record<string, unknown> | undefined;
  const products = result?.products as Record<string, unknown> | undefined;
  return Array.isArray(products?.product)
    ? (products.product as AliProduct[])
    : [];
}

function generatedPromotionLink(
  payload: Record<string, unknown>,
): string | null {
  const links: string[] = [];
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== "object") return;
    for (const [key, nested] of Object.entries(value)) {
      if (key === "promotion_link") {
        const candidate = asText(nested);
        if (candidate && /^https?:\/\//i.test(candidate)) links.push(candidate);
      }
      visit(nested);
    }
  };
  visit(payload);
  return links.sort((left, right) => left.length - right.length)[0] ?? null;
}

function urlList(value: unknown): string[] {
  const candidate = value as Record<string, unknown> | undefined;
  const values = Array.isArray(value)
    ? value
    : Array.isArray(candidate?.string)
      ? candidate.string
      : [];
  return values.filter(
    (item): item is string =>
      typeof item === "string" && /^https?:\/\//i.test(item),
  );
}

export class AliExpressAdapter implements SourceAdapter {
  readonly source = "aliexpress";
  private readonly cache = new Map<string, AliProduct>();

  private readiness() {
    return aliExpressReadiness({
      enabled: env.SOURCE_ALIEXPRESS_ENABLED,
      apiUrl: env.ALIEXPRESS_AFFILIATE_API_URL,
      appKey: env.ALIEXPRESS_APP_KEY,
      secret: env.ALIEXPRESS_APP_SECRET,
      trackingId: env.ALIEXPRESS_TRACKING_ID,
    });
  }

  private async api(method: string, business: Record<string, string | number>) {
    const readiness = this.readiness();
    if (!readiness.ready)
      throw new AppError(
        "SOURCE_UNAVAILABLE",
        `AliExpress integration is ${readiness.reason}`,
        false,
        503,
      );
    const params: Record<string, string> = {
      app_key: env.ALIEXPRESS_APP_KEY,
      format: "json",
      method,
      sign_method: "sha256",
      timestamp: String(Date.now()),
      v: "2.0",
    };
    for (const [key, value] of Object.entries(business))
      params[key] = String(value);
    const signingText = Object.keys(params)
      .sort()
      .map((key) => `${key}${params[key]}`)
      .join("");
    params.sign = createHmac("sha256", env.ALIEXPRESS_APP_SECRET)
      .update(signingText)
      .digest("hex")
      .toUpperCase();
    const response = await resilientFetch(env.ALIEXPRESS_AFFILIATE_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params),
      source: "aliexpress-api",
    });
    const payload = (await response.json()) as Record<string, unknown>;
    const error = payload.error_response as Record<string, unknown> | undefined;
    if (!response.ok || error) {
      throw new AppError(
        "SOURCE_UNAVAILABLE",
        `AliExpress API rejected the request: ${asText(error?.msg) ?? response.status}`,
        response.status >= 500 || response.status === 429,
        response.ok ? 502 : response.status,
        { apiCode: error?.code ?? null, apiSubCode: error?.sub_code ?? null },
      );
    }
    const apiResponse = Object.entries(payload).find(([key]) =>
      key.endsWith("_response"),
    )?.[1] as Record<string, unknown> | undefined;
    const respResult = apiResponse?.resp_result as
      Record<string, unknown> | undefined;
    const respCode = Number(respResult?.resp_code);
    if (Number.isFinite(respCode) && respCode !== 200) {
      throw new AppError(
        "SOURCE_UNAVAILABLE",
        `AliExpress API rejected the request: ${asText(respResult?.resp_msg) ?? respCode}`,
        false,
        502,
        { apiCode: respCode },
      );
    }
    return payload;
  }

  async discover(input: DiscoveryInput): Promise<DiscoveredProduct[]> {
    const limit = Math.min(Math.max(input.limit ?? 20, 1), 50);
    const payload = await this.api("aliexpress.affiliate.product.query", {
      fields:
        "product_id,product_title,product_detail_url,product_main_image_url,product_small_image_urls,product_video_url,video_url,target_sale_price,target_original_price,target_sale_price_currency,evaluate_rate,lastest_volume,promotion_link,ship_from_country,product_ship_from_country,delivery_days",
      keywords: input.query ?? "ofertas",
      category_ids: input.category ?? "",
      page_no: 1,
      page_size: Math.min(limit * 4, 50),
      target_currency: "BRL",
      target_language: "PT",
      ship_to_country: "BR",
      tracking_id: env.ALIEXPRESS_TRACKING_ID,
    });
    const eligible = productsFrom(payload).filter((product) => {
      const score = rating(product.evaluate_rate);
      const title = asText(product.product_title) ?? "";
      return (
        isAliExpressQueryMatch(title, input.query) &&
        (score == null || score >= 4.3) &&
        (asNumber(product.lastest_volume) ?? 0) >= 20
      );
    });
    const products = preferNationalCandidates(eligible, origin)
      .sort((left, right) => {
        const reputation =
          (rating(right.evaluate_rate) ?? 0) -
          (rating(left.evaluate_rate) ?? 0);
        return (
          reputation ||
          (asNumber(right.lastest_volume) ?? 0) -
            (asNumber(left.lastest_volume) ?? 0)
        );
      })
      .slice(0, limit);
    return products.flatMap((product) => {
      const id = asText(product.product_id) ?? String(product.product_id ?? "");
      const url = asText(product.product_detail_url);
      const title = asText(product.product_title);
      if (!id || !url || !title) return [];
      this.cache.set(url, product);
      return [{ externalId: id, canonicalUrl: url, title }];
    });
  }

  async extract({ url }: ExtractedProductInput): Promise<ExtractedProduct> {
    const cached = this.cache.get(url.toString());
    if (!cached)
      throw new AppError(
        "SOURCE_UNAVAILABLE",
        "AliExpress product is not present in the current discovery batch",
        true,
        409,
      );
    const cachedId = asText(cached.product_id) ?? String(cached.product_id);
    let product = cached;
    try {
      const detailPayload = await this.api(
        "aliexpress.affiliate.productdetail.get",
        {
          product_ids: cachedId,
          fields:
            "product_id,product_title,product_detail_url,product_main_image_url,product_small_image_urls,product_video_url,video_url,target_sale_price,target_original_price,target_sale_price_currency,evaluate_rate,lastest_volume,promotion_link,ship_from_country,product_ship_from_country,delivery_days",
          target_currency: "BRL",
          target_language: "PT",
          ship_to_country: "BR",
          country: "BR",
          tracking_id: env.ALIEXPRESS_TRACKING_ID,
        },
      );
      const detailed = productsFrom(detailPayload)[0];
      if (detailed) product = { ...cached, ...detailed };
    } catch {
      // Query data remains usable when the optional detail endpoint has no access.
    }
    const currentPriceCents = asCents(product.target_sale_price);
    if (!currentPriceCents)
      throw new AppError(
        "SOURCE_UNAVAILABLE",
        "AliExpress returned an invalid price",
        true,
      );
    const externalId = asText(product.product_id) ?? String(product.product_id);
    const mainImage = asText(product.product_main_image_url);
    const gallery = urlList(product.product_small_image_urls).filter(
      (url) => url !== mainImage,
    );
    const videos = [
      asText(product.product_video_url),
      asText(product.video_url),
    ].filter((url): url is string => Boolean(url));
    return {
      source: this.source,
      externalId,
      canonicalUrl: url.toString(),
      title: asText(product.product_title) ?? `AliExpress ${externalId}`,
      currentPriceCents,
      previousPriceCents: asCents(product.target_original_price),
      currency: asText(product.target_sale_price_currency) ?? "BRL",
      imageUrl: mainImage,
      availability: "in_stock",
      seller: "AliExpress",
      rating: rating(product.evaluate_rate),
      reviewCount: null,
      capturedAt: new Date().toISOString(),
      rawEvidence: {
        source: "aliexpress_affiliate_api",
        promotionLink: asText(product.promotion_link),
        shippingOrigin: origin(product),
        salesVolume: asNumber(product.lastest_volume),
        deliveryDays: asNumber(product.delivery_days),
        additionalImageUrls: gallery.slice(0, 8),
        videoUrls: videos.slice(0, 2),
        taxConfirmed: false,
      },
    };
  }

  async revalidate(product: ProductRef): Promise<PriceSnapshot> {
    const found = await this.discover({ query: product.externalId, limit: 10 });
    const match = found.find(
      (candidate) => candidate.externalId === product.externalId,
    );
    if (!match)
      throw new AppError(
        "SOURCE_UNAVAILABLE",
        "AliExpress product was not found",
        true,
      );
    const extracted = await this.extract({ url: new URL(match.canonicalUrl) });
    return {
      currentPriceCents: extracted.currentPriceCents,
      previousPriceCents: extracted.previousPriceCents ?? null,
      currency: extracted.currency,
      availability: extracted.availability,
      capturedAt: extracted.capturedAt,
    };
  }

  async createAffiliateLink(canonicalUrl: URL): Promise<AffiliateLinkResult> {
    let link: string | null = null;
    try {
      const payload = await this.api("aliexpress.affiliate.link.generate", {
        source_values: canonicalUrl.toString(),
        tracking_id: env.ALIEXPRESS_TRACKING_ID,
        promotion_link_type: 0,
      });
      link = generatedPromotionLink(payload);
    } catch {
      link = null;
    }
    link ??= asText(this.cache.get(canonicalUrl.toString())?.promotion_link);
    return link
      ? { status: "generated", url: link }
      : { status: "unsupported", reason: "promotion_link_missing" };
  }

  async healthCheck(): Promise<AdapterHealth> {
    const readiness = this.readiness();
    if (!readiness.ready)
      return { healthy: false, details: { reason: readiness.reason } };
    try {
      await this.api("aliexpress.affiliate.product.query", {
        fields: "product_id",
        keywords: "ofertas",
        page_no: 1,
        page_size: 1,
        target_currency: "BRL",
        target_language: "PT",
        ship_to_country: "BR",
        tracking_id: env.ALIEXPRESS_TRACKING_ID,
      });
      return { healthy: true, details: { reason: "connected" } };
    } catch (error) {
      return {
        healthy: false,
        details: {
          reason: error instanceof Error ? error.message : "api_error",
        },
      };
    }
  }
}
