import type { Logger } from "../config/logger.js";
import {
  assertShopperChatId,
  type ProductIdentity,
} from "../domain/product-watch.js";
import { resolveProductUrl } from "../shared/product-watch-url.js";
import {
  productWatchRepository,
  type ProductWatchRepository,
  type WatchRow,
} from "../adapters/persistence/product-watch-repository.js";
import {
  watchedProductSource,
  validWatchAffiliate,
  type WatchedProductSource,
} from "../adapters/sources/watched-product-source.js";
import { TelegramGateway } from "../adapters/telegram/telegram-gateway.js";
import { buildRichButtonRows } from "../adapters/telegram/telegram-rich-buttons.js";

export interface WatchItem {
  id: string;
  title: string;
  canonicalUrl: string;
  active: boolean;
  monitoring: string;
}
export interface WatchConfirmation extends WatchItem {
  alreadyWatching: boolean;
}
export interface PublicOfferProduct {
  offerId: string;
  title: string;
  canonicalUrl: string;
  affiliateUrl: string | null;
  currentPriceCents: number | null;
  productKey: string;
}
function item(row: WatchRow): WatchItem {
  return {
    id: row.id,
    title: row.title,
    canonicalUrl: row.identity.canonicalUrl,
    active: row.active,
    monitoring: row.monitoring,
  };
}
function escape(text: string): string {
  return text.replace(
    /[<>&\\`*_{}[\]()#+.!|~$-]/g,
    (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c] ?? `\\${c}`,
  );
}
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Delivery = Pick<TelegramGateway, "sendRichMessage">;

export class ProductWatchService {
  constructor(
    private readonly repository: ProductWatchRepository = productWatchRepository,
    private readonly source: WatchedProductSource = watchedProductSource,
    private readonly resolve: (
      raw: string,
    ) => Promise<ProductIdentity> = resolveProductUrl,
  ) {}
  async startShopper(chatId: number): Promise<void> {
    assertShopperChatId(chatId);
    await this.repository.start(chatId);
  }
  async hasStartedShopper(chatId: number): Promise<boolean> {
    assertShopperChatId(chatId);
    return this.repository.hasStarted(chatId);
  }
  async subscribeOffer(
    chatId: number,
    offerId: string,
  ): Promise<WatchConfirmation> {
    assertShopperChatId(chatId);
    if (!uuid.test(offerId))
      throw new Error("A publicação não está disponível.");
    const offer = await this.source.publicOffer(offerId);
    if (!offer)
      throw new Error(
        "A publicação não está disponível para acompanhamento. Envie o link do produto.",
      );
    const row = await this.repository.subscribe(chatId, {
      identity: offer.identity,
      title: offer.title,
      monitoring:
        offer.identity.store === "shopee" && !offer.identity.variantId
          ? "direct"
          : "catalog_wait",
      baseline: { priceCents: offer.priceCents, coupon: offer.coupon },
    });
    return { ...item(row), alreadyWatching: row.alreadyWatching };
  }
  async subscribeUrl(
    chatId: number,
    rawUrl: string,
  ): Promise<WatchConfirmation> {
    assertShopperChatId(chatId);
    if (rawUrl.length > 4096) throw new Error("Link de produto longo demais.");
    const identity = await this.resolve(rawUrl);
    const catalog = await this.source.catalog(identity);
    const row = await this.repository.subscribe(chatId, {
      identity,
      title: catalog?.title ?? `${identity.store} · ${identity.itemId}`,
      monitoring:
        identity.store === "shopee" && !identity.variantId
          ? "direct"
          : "catalog_wait",
      baseline: null,
    });
    return { ...item(row), alreadyWatching: row.alreadyWatching };
  }
  async listProductWatches(chatId: number): Promise<WatchItem[]> {
    assertShopperChatId(chatId);
    return (await this.repository.list(chatId)).map(item);
  }
  async removeProductWatch(chatId: number, watchId: string): Promise<boolean> {
    assertShopperChatId(chatId);
    return uuid.test(watchId) ? this.repository.remove(chatId, watchId) : false;
  }
  async getPublicOfferProduct(
    offerId: string,
  ): Promise<PublicOfferProduct | null> {
    if (!uuid.test(offerId)) return null;
    const offer = await this.source.publicOffer(offerId);
    return offer
      ? {
          offerId,
          title: offer.title,
          canonicalUrl: offer.identity.canonicalUrl,
          affiliateUrl: offer.isCurrent === false ? null : offer.affiliateUrl,
          currentPriceCents:
            offer.isCurrent === false ? null : offer.priceCents,
          productKey: offer.identity.key,
        }
      : null;
  }
  async dispatchProductWatches(
    logger: Logger,
    limit = 20,
    delivery: Delivery = new TelegramGateway(logger),
  ): Promise<{ checked: number; sent: number; unavailable: number }> {
    const boundedLimit = Math.min(
      20,
      Math.max(1, Number.isFinite(limit) ? Math.floor(limit) : 20),
    );
    const result = { checked: 0, sent: 0, unavailable: 0 };
    let attempts = 0;
    for (const identity of await this.repository.productsToCheck(
      boundedLimit,
    )) {
      if (attempts >= boundedLimit) break;
      result.checked++;
      try {
        const offer = await this.source.check(identity);
        if (
          !offer ||
          offer.identity.key !== identity.key ||
          !Number.isSafeInteger(offer.priceCents) ||
          offer.priceCents <= 0 ||
          !validWatchAffiliate(offer.affiliateUrl)
        ) {
          result.unavailable++;
          continue;
        }
        for (const watch of await this.repository.subscribers(identity.key)) {
          if (attempts >= boundedLimit) break;
          const reservation = await this.repository.reserve(watch, offer);
          if (!reservation) continue;
          // Recheck cancellation/blocked status just before transport.
          if (!(await this.repository.canDeliver(watch.chatId, watch.id))) {
            await this.repository.markRejected(reservation);
            continue;
          }
          attempts++;
          try {
            const price = (offer.priceCents / 100).toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            });
            const markdown = `**Nova condição para seu produto**\n\n${escape(offer.title.slice(0, 250))}\n\n**${escape(price)}**${offer.coupon ? `\nCupom: ${escape(offer.coupon)}` : ""}\n\n${offer.availability === "unknown" ? "Confira estoque e variação na loja. " : ""}Preço sujeito a alteração. Link de afiliado do Freguesia.\n\n${buildRichButtonRows(
              [
                [
                  {
                    text: "🛒 Comprar",
                    url: offer.affiliateUrl,
                    style: "success",
                  },
                ],
                [
                  { text: "🔔 Meus alertas", callbackData: "shop:list" },
                  {
                    text: "Remover alerta",
                    callbackData: `shop:remove:${watch.id}`,
                    style: "danger",
                  },
                ],
              ],
            )}`;
            const sent = await delivery.sendRichMessage(
              { chatId: String(watch.chatId), markdown },
              { retryAmbiguousErrors: false },
            );
            result.sent++;
            await this.repository.markSent(reservation, sent.messageId);
          } catch (error) {
            const rejected =
              error instanceof Error &&
              error.name === "TelegramMessageRejectedError";
            const code =
              error && typeof error === "object" && "errorCode" in error
                ? Number(error.errorCode)
                : undefined;
            if (rejected) {
              if (
                code === 403 ||
                (!code &&
                  /^Telegram sendRichMessage failed: Forbidden: (bot was blocked by the user|user is deactivated)/.test(
                    (error as Error).message,
                  ))
              )
                await this.repository.block(watch.chatId);
              await this.repository.markRejected(reservation);
            } else await this.repository.markUnknown(reservation);
            logger.warn(
              { err: error, productKey: identity.key },
              "Product watch delivery failed",
            );
          }
        }
      } catch (error) {
        result.unavailable++;
        logger.warn(
          { err: error, productKey: identity.key },
          "Product watch check unavailable",
        );
      } finally {
        await this.repository.touchProduct(identity.key);
      }
    }
    return result;
  }
}
export const productWatchService = new ProductWatchService();
export const startShopper = (chatId: number): Promise<void> =>
  productWatchService.startShopper(chatId);
export const hasStartedShopper = (chatId: number): Promise<boolean> =>
  productWatchService.hasStartedShopper(chatId);
export const subscribeOffer = (
  chatId: number,
  offerId: string,
): Promise<WatchConfirmation> =>
  productWatchService.subscribeOffer(chatId, offerId);
export const subscribeUrl = (
  chatId: number,
  rawUrl: string,
): Promise<WatchConfirmation> =>
  productWatchService.subscribeUrl(chatId, rawUrl);
export const listProductWatches = (chatId: number): Promise<WatchItem[]> =>
  productWatchService.listProductWatches(chatId);
export const removeProductWatch = (
  chatId: number,
  watchId: string,
): Promise<boolean> => productWatchService.removeProductWatch(chatId, watchId);
export const getPublicOfferProduct = (
  offerId: string,
): Promise<PublicOfferProduct | null> =>
  productWatchService.getPublicOfferProduct(offerId);
export const dispatchProductWatches = (
  logger: Logger,
  limit?: number,
): Promise<{ checked: number; sent: number; unavailable: number }> =>
  productWatchService.dispatchProductWatches(logger, limit);
