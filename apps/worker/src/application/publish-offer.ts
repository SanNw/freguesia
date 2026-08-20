import type { Logger } from "../config/logger.js";
import { offerRepository } from "../adapters/persistence/offer-repository.js";
import { productRepository } from "../adapters/persistence/product-repository.js";
import {
  publicationRepository,
  workflowEventRepository,
} from "../adapters/persistence/repositories.js";
import { TelegramGateway } from "../adapters/telegram/telegram-gateway.js";
import { publicationEnv as env } from "../config/runtime.js";
import { AppError } from "../shared/errors.js";
import {
  classifyProductNiche,
  productNicheChannel,
} from "../domain/product-niche.js";
import { buildAffiliateCaptionLink } from "../domain/affiliate-caption-link.js";
import {
  appendChannelsFooter,
  CHANNELS_FOOTER,
  CHANNELS_FOOTER_TEXT,
} from "../domain/channels-footer.js";

const PRICE_NOTICE = "Preço sujeito a alteração.";

export function buildPublicationCaption(
  caption: string,
  affiliateUrl: string,
): string {
  const affiliateLink = buildAffiliateCaptionLink(affiliateUrl);
  const legacyMarkdownLink = `[🛒 Comprar com desconto](${affiliateUrl})`;
  const cleanedCaption = caption
    .replaceAll(legacyMarkdownLink, "")
    .replaceAll(affiliateLink, "")
    .replaceAll(affiliateUrl, "")
    .replace(/Preço sujeito a alteração\.\s*Link de afiliado\./giu, "")
    .replace(/Preco sujeito a alteracao\.\s*Link de afiliado\./giu, "")
    .replace(
      /A Freguesia pode receber comissão por compras realizadas pelo link\./giu,
      "",
    )
    .replace(
      /A Freguesia pode receber comissao por compras realizadas pelo link\./giu,
      "",
    )
    .replace(/Preço sujeito a alteração\./giu, "")
    .replace(/Preco sujeito a alteracao\./giu, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const paragraphs = [cleanedCaption];
  paragraphs.push(PRICE_NOTICE);
  return paragraphs.filter(Boolean).join("\n\n");
}

export async function publishOffer(
  offerId: string,
  idempotencyKey: string,
  logger: Logger,
): Promise<{ status: string; messageId: number }> {
  if (await publicationRepository.existsByIdempotencyKey(idempotencyKey)) {
    logger.info(
      { offerId, idempotencyKey },
      "Publication already exists (idempotent)",
    );
    return { status: "already_published", messageId: 0 };
  }

  const offer = await offerRepository.getOffer(offerId);
  if (!offer) {
    throw new AppError("OFFER_NOT_FOUND", "Offer not found", false, 404);
  }

  if (offer.status !== "approved" && offer.status !== "scheduled") {
    throw new AppError(
      "VALIDATION_FAILED",
      `Offer status ${offer.status} cannot be published`,
      false,
      409,
    );
  }

  if (!offer.affiliateUrl) {
    throw new AppError(
      "AFFILIATE_LINK_FAILED",
      "Offer has no affiliate URL",
      false,
      422,
    );
  }

  if (!offer.imageUrl) {
    throw new AppError(
      "VALIDATION_FAILED",
      "Offer must have an image before publication",
      false,
      422,
    );
  }

  if (offer.expiresAt && new Date(offer.expiresAt).getTime() <= Date.now()) {
    throw new AppError(
      "VALIDATION_FAILED",
      "Offer expired before publication",
      false,
      409,
    );
  }

  const product = await productRepository.getById(offer.productId);
  if (!product || product.availability !== "in_stock") {
    throw new AppError(
      "VALIDATION_FAILED",
      "Product is not confirmed in stock",
      false,
      409,
    );
  }

  if (await publicationRepository.existsForProductToday(offer.productId)) {
    throw new AppError(
      "VALIDATION_FAILED",
      "Product was already published today",
      false,
      409,
    );
  }

  if (!(await offerRepository.isBestPromotionForProduct(offer.id))) {
    throw new AppError(
      "VALIDATION_FAILED",
      "A better promotion exists for this product",
      false,
      409,
    );
  }

  const rate = await publicationRepository.getRateLimitSnapshot();
  if (
    rate.hourly >= env.MAX_PUBLICATIONS_PER_HOUR ||
    rate.daily >= env.MAX_PUBLICATIONS_PER_DAY
  ) {
    throw new AppError(
      "VALIDATION_FAILED",
      "Publication rate limit reached",
      true,
      429,
    );
  }
  if (
    rate.lastPublishedAt &&
    Date.now() - new Date(rate.lastPublishedAt).getTime() <
      env.PUBLICATION_MIN_INTERVAL_SECONDS * 1000
  ) {
    throw new AppError(
      "VALIDATION_FAILED",
      "Minimum publication interval has not elapsed",
      true,
      429,
    );
  }

  const caption = offer.proposedCaption || `${offer.score} pontos`;
  let publicationCaption = buildPublicationCaption(caption, offer.affiliateUrl);
  let fullCaption = appendChannelsFooter(publicationCaption);
  if (fullCaption.length > env.TELEGRAM_MAX_CAPTION_LENGTH) {
    publicationCaption = publicationCaption.slice(
      0,
      Math.max(0, env.TELEGRAM_MAX_CAPTION_LENGTH - CHANNELS_FOOTER.length - 2),
    );
    fullCaption = appendChannelsFooter(publicationCaption);
  }

  const gateway = new TelegramGateway(logger);
  const niche = classifyProductNiche(product.title, product.category);
  const destinationChannelId = productNicheChannel(niche);

  let telegramMessageId = 0;
  try {
    if (env.TELEGRAM_RICH_TEXT_ENABLED) {
      try {
        const result = await gateway.sendRichMessage({
          chatId: destinationChannelId,
          markdown: gateway.buildOfferRichMarkdown(
            [offer.imageUrl, ...offer.additionalImageUrls],
            publicationCaption,
          ),
          footer: CHANNELS_FOOTER_TEXT,
          replyMarkup: gateway.buildPublicationKeyboard(offer.affiliateUrl),
        });
        telegramMessageId = result.messageId;
      } catch (error) {
        logger.warn(
          { err: error, offerId },
          "Rich publication failed; using photo fallback",
        );
        const result = await gateway.sendPhoto({
          chatId: destinationChannelId,
          photo: offer.imageUrl,
          caption: fullCaption,
          replyMarkup: gateway.buildPublicationKeyboard(offer.affiliateUrl),
        });
        telegramMessageId = result.messageId;
      }
    } else {
      const result = await gateway.sendPhoto({
        chatId: destinationChannelId,
        photo: offer.imageUrl,
        caption: fullCaption,
        replyMarkup: gateway.buildPublicationKeyboard(offer.affiliateUrl),
      });
      telegramMessageId = result.messageId;
    }

    const publicationId = crypto.randomUUID();
    await publicationRepository.insert({
      id: publicationId,
      offerId,
      channelId: destinationChannelId,
      telegramMessageId,
      finalCaption: fullCaption,
      finalImageUrl: offer.imageUrl ?? null,
      finalAffiliateUrl: offer.affiliateUrl ?? "",
      status: "published",
      idempotencyKey,
      publishedAt: new Date().toISOString(),
    });

    await offerRepository.updateStatus(offerId, "published");

    await workflowEventRepository.record({
      correlationId: crypto.randomUUID(),
      entityType: "offer",
      entityId: offerId,
      eventType: "offer.published",
      actor: "system",
      payload: {
        publicationId,
        telegramMessageId,
        niche,
        destinationChannelId,
      },
    });

    logger.info(
      { offerId, publicationId, telegramMessageId },
      "Offer published",
    );

    return { status: "published", messageId: telegramMessageId };
  } catch (e) {
    await offerRepository.updateStatus(offerId, "failed", "PUBLICATION_ERROR");

    await workflowEventRepository.record({
      correlationId: crypto.randomUUID(),
      entityType: "offer",
      entityId: offerId,
      eventType: "offer.publish_failed",
      actor: "system",
      payload: { error: e instanceof Error ? e.message : String(e) },
    });

    logger.error(
      { offerId, err: e },
      "Publication failed, offer marked as failed",
    );

    throw new AppError(
      "PUBLICATION_FAILED",
      e instanceof Error ? e.message : "Failed to publish to Telegram",
      true,
    );
  }
}
