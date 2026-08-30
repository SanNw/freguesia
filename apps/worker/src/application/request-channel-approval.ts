import { offerRepository } from "../adapters/persistence/offer-repository.js";
import { productRepository } from "../adapters/persistence/product-repository.js";
import { workflowEventRepository } from "../adapters/persistence/repositories.js";
import { TelegramGateway } from "../adapters/telegram/telegram-gateway.js";
import type { Logger } from "../config/logger.js";
import { telegramEnv as env } from "../config/runtime.js";
import {
  productNicheLabel,
  type ProductNicheDecision,
} from "../domain/product-niche.js";
import { AppError } from "../shared/errors.js";

const confidenceLabel = {
  high: "alta",
  medium: "média",
  low: "baixa",
} as const;

export async function requestChannelApproval(
  offerId: string,
  decision: ProductNicheDecision,
  logger: Logger,
): Promise<{ messageId: number; status: string }> {
  if (
    await workflowEventRepository.exists(
      "offer",
      offerId,
      "offer.channel_approval_requested",
    )
  ) {
    return { messageId: 0, status: "already_pending" };
  }

  const offer = await offerRepository.getOffer(offerId);
  if (!offer || offer.status !== "pending_approval") {
    throw new AppError(
      "INVALID_STATE",
      "Offer is not waiting for channel approval",
      false,
      409,
    );
  }
  if (!offer.imageUrl) {
    throw new AppError(
      "VALIDATION_FAILED",
      "Offer must have an image before channel approval",
      false,
      422,
    );
  }
  const product = await productRepository.getById(offer.productId);
  if (!product) {
    throw new AppError("OFFER_NOT_FOUND", "Product not found", false, 404);
  }

  const gateway = new TelegramGateway(logger);
  const caption = [
    "Canal precisa de confirmação",
    `Sugestão: ${productNicheLabel(decision.niche)}`,
    `Confiança: ${confidenceLabel[decision.confidence]}`,
    `Evidência: ${decision.evidence}`,
    "",
    offer.proposedCaption || `Oferta: ${product.title}`,
  ].join("\n");

  let messageId: number;
  if (env.TELEGRAM_RICH_TEXT_ENABLED) {
    try {
      const result = await gateway.sendRichMessage({
        chatId: env.TELEGRAM_APPROVAL_CHAT_ID,
        markdown: gateway.buildOfferRichMarkdown(
          [offer.imageUrl, ...offer.additionalImageUrls],
          `${caption}\n\n${gateway.buildChannelApprovalRichButtons(offer.id)}`,
        ),
      });
      messageId = result.messageId;
    } catch (error) {
      logger.warn(
        { err: error, offerId },
        "Rich channel approval failed; using photo fallback",
      );
      const result = await gateway.sendPhoto({
        chatId: env.TELEGRAM_APPROVAL_CHAT_ID,
        photo: offer.imageUrl,
        caption,
        replyMarkup: gateway.buildChannelApprovalKeyboard(offer.id),
      });
      messageId = result.messageId;
    }
  } else {
    const result = await gateway.sendPhoto({
      chatId: env.TELEGRAM_APPROVAL_CHAT_ID,
      photo: offer.imageUrl,
      caption,
      replyMarkup: gateway.buildChannelApprovalKeyboard(offer.id),
    });
    messageId = result.messageId;
  }

  await workflowEventRepository.record({
    correlationId: crypto.randomUUID(),
    entityType: "offer",
    entityId: offerId,
    eventType: "offer.channel_approval_requested",
    actor: "system",
    payload: { messageId, decision },
  });
  logger.info({ offerId, messageId, decision }, "Channel approval requested");
  return { messageId, status: "pending_approval" };
}
