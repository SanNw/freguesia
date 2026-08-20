import type { SourceAdapter } from "./source-adapter.js";
import type { DiscoveredProduct, DiscoveryInput } from "./source-adapter.js";
import type { ExtractedProduct } from "../../domain/offer.js";
import type { PriceSnapshot, ProductRef } from "../../domain/price.js";
import type { AffiliateLinkResult } from "../../domain/affiliate-link.js";
import { browserPool } from "../browser/browser-pool.js";
import { detectCaptcha, detectBlocked } from "../browser/captcha-detector.js";
import { validateExternalUrl } from "../../shared/url.js";
import { mercadoLivreEnv as env } from "../../config/runtime.js";
import { AppError } from "../../shared/errors.js";

const ML_ALLOWED_DOMAINS = [
  "mercadolivre.com.br",
  "www.mercadolivre.com.br",
  "produto.mercadolivre.com.br",
  "ofertas.mercadolivre.com.br",
];

export class MercadolivreExperimentalAdapter implements SourceAdapter {
  readonly source = "mercadolivre-experimental";

  async discover(input: DiscoveryInput): Promise<DiscoveredProduct[]> {
    const maxPages = env.SOURCE_MERCADOLIVRE_MAX_PAGES_PER_RUN;
    const limit = input.limit ?? 20;
    const query = input.query;
    const category = input.category;

    const baseUrl = query
      ? `https://lista.mercadolivre.com.br/${encodeURIComponent(query)}`
      : category
        ? `https://ofertas.mercadolivre.com.br/${category}`
        : "https://ofertas.mercadolivre.com.br";

    const context = await browserPool.acquire();
    try {
      const page = await context.newPage();
      const products: DiscoveredProduct[] = [];
      const seen = new Set<string>();

      for (
        let pageNum = 1;
        pageNum <= maxPages && products.length < limit;
        pageNum++
      ) {
        const url = pageNum === 1 ? baseUrl : `${baseUrl}?page=${pageNum}`;

        await page.goto(url, { timeout: 30000 });
        await page.waitForLoadState("domcontentloaded", { timeout: 10000 });

        const content = await page.content();
        if (detectCaptcha(content) || detectBlocked(content)) {
          throw new AppError(
            "SOURCE_CAPTCHA_REQUIRED",
            "Captcha/bloqueio detectado em página de ofertas",
            true,
          );
        }

        const links = await page
          .locator("a[href*='/p/']")
          .evaluateAll((anchors) =>
            anchors.slice(0, 20).map((a: { href: string }) => a.href),
          );

        for (const link of links) {
          if (products.length >= limit) break;
          if (seen.has(link)) continue;
          seen.add(link);

          const productId =
            link.match(/[/?]p=(\d+)/)?.[1] || link.match(/\/p\/(\d+)/)?.[1];
          products.push({
            externalId: productId ?? `${link}-${pageNum}`,
            canonicalUrl: link,
            title: `ML-${productId ?? "item"}`,
          });
        }
      }

      return products;
    } finally {
      browserPool.release();
    }
  }

  async extract({ url }: { url: URL }): Promise<ExtractedProduct> {
    const validation = validateExternalUrl(
      url.toString(),
      ML_ALLOWED_DOMAINS,
      true,
    );
    if (!validation.valid) {
      throw new AppError(
        "VALIDATION_FAILED",
        `URL inválida para ML: ${validation.reason}`,
      );
    }

    const context = await browserPool.acquire();
    try {
      const page = await context.newPage();
      await page.goto(url.toString(), { timeout: 30000 });
      await page.waitForLoadState("domcontentloaded", { timeout: 15000 });

      const content = await page.content();
      if (detectCaptcha(content) || detectBlocked(content)) {
        throw new AppError(
          "SOURCE_CAPTCHA_REQUIRED",
          "Captcha/bloqueio detectado na página do produto",
          true,
        );
      }

      const title = await page
        .locator('meta[property="og:title"]')
        .getAttribute("content");
      const priceStr = await page
        .locator('meta[property="product:price:amount"]')
        .getAttribute("content");
      const currency = await page
        .locator('meta[property="product:price:currency"]')
        .getAttribute("content");
      const image = await page
        .locator('meta[property="og:image"]')
        .getAttribute("content");
      const availabilityStr = await page
        .locator('meta[property="product:availability"]')
        .getAttribute("content");

      const currentPriceCents = priceStr
        ? Math.round(parseFloat(priceStr) * 100)
        : 0;

      if (currentPriceCents <= 0) {
        throw new AppError(
          "SOURCE_SELECTOR_NOT_FOUND",
          "Não foi possível extrair preço do produto",
          true,
        );
      }

      const availabilityMap: Record<string, string> = {
        "in stock": "in_stock",
        "em estoque": "in_stock",
        "out of stock": "out_of_stock",
        "fora de estoque": "out_of_stock",
        preorder: "preorder",
        "pré-encomenda": "preorder",
      };

      const availability =
        availabilityMap[(availabilityStr || "").toLowerCase().trim()] ||
        "unknown";

      const productId =
        url.toString().match(/[/?]p=(\d+)/)?.[1] ||
        url.toString().match(/\/p\/(\d+)/)?.[1] ||
        crypto.randomUUID().slice(0, 32);

      return {
        source: this.source,
        externalId: productId,
        canonicalUrl: url.toString(),
        title: title || `Produto ML`,
        currentPriceCents,
        previousPriceCents: null,
        currency: currency || "BRL",
        imageUrl: image || null,
        availability: availability as
          "in_stock" | "out_of_stock" | "preorder" | "unknown",
        seller: null,
        rating: null,
        reviewCount: null as number | null,
        capturedAt: new Date().toISOString(),
        rawEvidence: {
          selector: "meta[property='product:price:amount']",
          extractedAt: new Date().toISOString(),
        },
      };
    } finally {
      browserPool.release();
    }
  }

  async revalidate(product: ProductRef): Promise<PriceSnapshot> {
    const url = new URL(product.canonicalUrl);
    const extracted = await this.extract({ url });

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
      reason:
        "Mercado Livre affiliate links require manual insertion via Portal do Afiliado",
    };
  }

  async healthCheck() {
    if (!env.SOURCE_MERCADOLIVRE_ENABLED) {
      return {
        healthy: false,
        details: { reason: "disabled_by_config" },
      };
    }

    try {
      const context = await browserPool.acquire();
      try {
        const page = await context.newPage();
        await page.goto("https://www.mercadolivre.com.br", { timeout: 15000 });
        const title = await page.title();
        return {
          healthy: title.includes("Mercado Livre"),
          details: { title, source: this.source },
        };
      } finally {
        browserPool.release();
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        healthy: false,
        details: { error: message, source: this.source },
      };
    }
  }
}
