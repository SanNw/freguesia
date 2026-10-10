import { createHash } from "node:crypto";

export interface ProductIdentity {
  key: string;
  store: string;
  itemId: string;
  shopId?: string;
  variantId?: string;
  canonicalUrl: string;
}

export const productHosts = new Set([
  "shopee.com.br",
  "www.shopee.com.br",
  "amazon.com.br",
  "www.amazon.com.br",
  "mercadolivre.com.br",
  "www.mercadolivre.com.br",
  "produto.mercadolivre.com.br",
  "kabum.com.br",
  "www.kabum.com.br",
  "aliexpress.com",
  "www.aliexpress.com",
  "pt.aliexpress.com",
]);

export function safeProductUrl(raw: string): URL | null {
  try {
    const url = new URL(raw.trim());
    return url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port
      ? url
      : null;
  } catch {
    return null;
  }
}

export function parseProductIdentity(raw: string): ProductIdentity | null {
  const url = safeProductUrl(raw);
  if (!url || !productHosts.has(url.hostname)) return null;
  let store: string, itemId: string, key: string, canonicalUrl: string;
  let shopId: string | undefined;
  let variantParam: string | undefined;
  const path = url.pathname;
  const host = url.hostname.replace(/^www\./, "");
  if (host === "shopee.com.br") {
    const match =
      path.match(/^\/product\/(\d+)\/(\d+)\/?$/) ??
      path.match(/-i\.(\d+)\.(\d+)\/?$/);
    if (!match) return null;
    store = "shopee";
    shopId = match[1];
    itemId = match[2];
    key = `shopee:${shopId}:${itemId}`;
    canonicalUrl = `https://shopee.com.br/product/${shopId}/${itemId}`;
    variantParam = "model_id";
  } else if (host === "amazon.com.br") {
    const match = path.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?:\/|$)/i);
    if (!match) return null;
    store = "amazon";
    itemId = match[1].toUpperCase();
    key = `${store}:${itemId}`;
    canonicalUrl = `https://www.amazon.com.br/dp/${itemId}`;
  } else if (host === "kabum.com.br") {
    const match = path.match(/^\/produto\/(\d+)(?:\/|$)/);
    if (!match) return null;
    store = "kabum";
    itemId = match[1];
    key = `${store}:${itemId}`;
    canonicalUrl = `https://www.kabum.com.br/produto/${itemId}`;
    variantParam = "variant_id";
  } else if (host.endsWith("mercadolivre.com.br")) {
    const catalog = path.match(/\/p\/(MLB\d+)(?:\/|$)/i);
    const listing = path.match(/^\/(MLB)-(\d+)(?:-|\/|$)/i);
    if (!catalog && !listing) return null;
    store = "mercadolivre";
    itemId = catalog ? catalog[1].toUpperCase() : `MLB${listing![2]}`;
    key = `${store}:${catalog ? "catalog" : "item"}:${itemId}`;
    canonicalUrl = catalog
      ? `https://www.mercadolivre.com.br/p/${itemId}`
      : `https://produto.mercadolivre.com.br/MLB-${listing![2]}-_JM`;
    variantParam = "variation_id";
  } else {
    const match = path.match(/^\/item\/(\d+)\.html\/?$/);
    if (!match) return null;
    store = "aliexpress";
    itemId = match[1];
    key = `${store}:${itemId}`;
    canonicalUrl = `https://www.aliexpress.com/item/${itemId}.html`;
    variantParam = "sku_id";
  }
  // Variant aliases are accepted only when they identify a single consistent option.
  const aliases = [
    ...new Set(
      [variantParam, "variant_id", "variation_id", "model_id", "sku_id"].filter(
        (v): v is string => Boolean(v),
      ),
    ),
  ];
  const variants = aliases.flatMap((p) => url.searchParams.getAll(p));
  if (
    variants.some((v) => !/^[A-Za-z0-9_-]{1,80}$/.test(v)) ||
    new Set(variants).size > 1 ||
    aliases.some((p) => url.searchParams.getAll(p).length > 1)
  )
    return null;
  const variantId = variants[0];
  if (variantId) {
    key += `:variant:${variantId}`;
    canonicalUrl += `?${variantParam ?? "variant_id"}=${encodeURIComponent(variantId)}`;
  }
  if (itemId === "0" || shopId === "0") return null;
  return {
    key,
    store,
    itemId,
    ...(shopId ? { shopId } : {}),
    ...(variantId ? { variantId } : {}),
    canonicalUrl,
  };
}

export interface PromotionCondition {
  priceCents: number;
  coupon: string | null;
}
export function promotionFingerprint(
  priceCents: number,
  coupon: string | null,
): string {
  return createHash("sha256")
    .update(JSON.stringify([priceCents, coupon?.trim() || null]))
    .digest("hex");
}
export function isNewPromotion(
  baseline: PromotionCondition | null,
  candidate: PromotionCondition,
): boolean {
  if (!Number.isSafeInteger(candidate.priceCents) || candidate.priceCents <= 0)
    return false;
  return (
    !baseline ||
    candidate.priceCents < baseline.priceCents ||
    (candidate.priceCents === baseline.priceCents &&
      (candidate.coupon?.trim() || null) !== (baseline.coupon?.trim() || null))
  );
}

export function assertShopperChatId(chatId: number): void {
  if (!Number.isSafeInteger(chatId) || chatId <= 0)
    throw new Error("Use um identificador válido de conversa privada.");
}
