import type { Logger } from "../config/logger.js";
import { offerRepository } from "../adapters/persistence/offer-repository.js";
import { productRepository } from "../adapters/persistence/product-repository.js";
import { workflowEventRepository } from "../adapters/persistence/repositories.js";
import { TelegramGateway } from "../adapters/telegram/telegram-gateway.js";
import { telegramEnv as env } from "../config/runtime.js";
import { AppError } from "../shared/errors.js";
import {
  classifyProductNiche,
  productNicheLabel,
} from "../domain/product-niche.js";
import {
  appendChannelsFooter,
  CHANNELS_FOOTER_TEXT,
} from "../domain/channels-footer.js";

export async function requestApproval(
  offerId: string,
  logger: Logger,
): Promise<{ messageId: number; status: string }> {
  const offer = await offerRepository.getOffer(offerId);
  if (!offer) {
    throw new AppError("OFFER_NOT_FOUND", "Offer not found", false, 404);
  }

  const product = await productRepository.getById(offer.productId);
  if (!product) {
    throw new AppError(
      "OFFER_NOT_FOUND",
      "Product not found for offer",
      false,
      404,
    );
  }

  if (!offer.imageUrl) {
    throw new AppError(
      "VALIDATION_FAILED",
      "Offer must have an image before approval",
      false,
      422,
    );
  }
  if (!offer.affiliateUrl) {
    throw new AppError(
      "AFFILIATE_LINK_FAILED",
      "Offer must have an affiliate URL before approval",
      false,
      422,
    );
  }
  if (!["validated", "pending_approval"].includes(offer.status)) {
    throw new AppError(
      "INVALID_STATE",
      `Offer status ${offer.status} cannot request approval`,
      false,
      409,
    );
  }

  const gateway = new TelegramGateway(logger);
  const shortId = offer.id.slice(0, 8);
  const keyboard = gateway.buildApprovalKeyboard(shortId, offer.affiliateUrl);

  let messageId: number;

  const niche = classifyProductNiche(product.title, product.category);
  const baseCaption = offer.proposedCaption || `Oferta: ${product.title}`;
  const caption = `Destino: ${productNicheLabel(niche)}\n\n${baseCaption}`;
  if (env.TELEGRAM_RICH_TEXT_ENABLED) {
    try {
      const result = await gateway.sendRichMessage({
        chatId: env.TELEGRAM_APPROVAL_CHAT_ID,
        markdown: gateway.buildOfferRichMarkdown(
          [offer.imageUrl, ...offer.additionalImageUrls],
          caption,
        ),
        footer: CHANNELS_FOOTER_TEXT,
        replyMarkup: keyboard,
      });
      messageId = result.messageId;
    } catch (error) {
      logger.warn(
        { err: error, offerId },
        "Rich approval failed; using photo fallback",
      );
      const result = await gateway.sendPhoto({
        chatId: env.TELEGRAM_APPROVAL_CHAT_ID,
        photo: offer.imageUrl,
        caption: appendChannelsFooter(caption),
        replyMarkup: keyboard,
      });
      messageId = result.messageId;
    }
  } else {
    const result = await gateway.sendPhoto({
      chatId: env.TELEGRAM_APPROVAL_CHAT_ID,
      photo: offer.imageUrl,
      caption: appendChannelsFooter(caption),
      replyMarkup: keyboard,
    });
    messageId = result.messageId;
  }

  await offerRepository.updateStatus(offerId, "pending_approval");

  await workflowEventRepository.record({
    correlationId: crypto.randomUUID(),
    entityType: "offer",
    entityId: offerId,
    eventType: "offer.pending_approval",
    actor: "system",
    payload: { messageId, shortId, niche },
  });

  logger.info({ offerId, messageId }, "Approval requested in Telegram");

  return { messageId, status: "pending_approval" };
}
