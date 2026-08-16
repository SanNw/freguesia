import type { Logger } from "../config/logger.js";
import { offerRepository } from "../adapters/persistence/offer-repository.js";
import { productRepository } from "../adapters/persistence/product-repository.js";
import { workflowEventRepository } from "../adapters/persistence/repositories.js";
import { TelegramGateway } from "../adapters/telegram/telegram-gateway.js";
import { env } from "../config/env.js";
import { AppError } from "../shared/errors.js";

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

  const gateway = new TelegramGateway(logger);
  const shortId = offer.id.slice(0, 8);
  const keyboard = gateway.buildApprovalKeyboard(shortId);

  let messageId: number;

  if (offer.imageUrl) {
    const result = await gateway.sendPhoto({
      chatId: env.TELEGRAM_APPROVAL_CHAT_ID,
      photo: offer.imageUrl,
      caption: offer.proposedCaption || `Oferta: ${product.title}`,
      replyMarkup: keyboard,
    });
    messageId = result.messageId;
  } else {
    const result = await gateway.sendMessage(
      env.TELEGRAM_APPROVAL_CHAT_ID,
      offer.proposedCaption || `Oferta: ${product.title}`,
    );
    messageId = result.messageId;
  }

  await offerRepository.updateStatus(offerId, "pending_approval");

  await workflowEventRepository.record({
    correlationId: offer.idempotencyKey,
    entityType: "offer",
    entityId: offerId,
    eventType: "offer.pending_approval",
    actor: "system",
    payload: { messageId, shortId },
  });

  logger.info({ offerId, messageId }, "Approval requested in Telegram");

  return { messageId, status: "pending_approval" };
}
