import type { Logger } from "../../config/logger.js";
import { offerRepository } from "../persistence/offer-repository.js";
import { publicationRepository, workflowEventRepository } from "../persistence/repositories.js";
import { TelegramGateway } from "../../adapters/telegram/telegram-gateway.js";
import { env } from "../../config/env.js";
import { AppError } from "../../shared/errors.js";
import { formatBRL, calculateDiscountPercent } from "../../domain/price.js";

export async function publishOffer(
  offerId: string,
  idempotencyKey: string,
  logger: Logger,
): Promise<{ status: string; messageId: number }> {

  if (await publicationRepository.existsByIdempotencyKey(idempotencyKey)) {
    logger.info({ offerId, idempotencyKey }, "Publication already exists (idempotent)");
    return { status: "already_published", messageId: 0 };
  }

  const offer = await offerRepository.getOffer(offerId);
  if (!offer) {
    throw new AppError("OFFER_NOT_FOUND", "Offer not found", false, 404);
  }

  if (offer.status !== "approved" && offer.status !== "scheduled") {
    throw new AppError("VALIDATION_FAILED", `Offer status ${offer.status} cannot be published`, false, 409);
  }

  if (!offer.affiliateUrl) {
    throw new AppError("AFFILIATE_LINK_FAILED", "Offer has no affiliate URL", false, 422);
  }

  const caption = offer.proposedCaption || `${offer.score} pontos`;
  const footer = env.TELEGRAM_MESSAGE_FOOTER;
  const fullCaption = `${caption}\n\n${footer}`.slice(0, env.TELEGRAM_MAX_CAPTION_LENGTH);

  const gateway = new TelegramGateway(logger);

  let telegramMessageId = 0;
  if (offer.imageUrl) {
    const result = await gateway.sendPhoto({
      chatId: env.TELEGRAM_PUBLIC_CHANNEL_ID,
      photo: offer.imageUrl,
      caption: fullCaption,
    });
    telegramMessageId = result.messageId;
  } else {
    const result = await gateway.sendMessage(
      env.TELEGRAM_PUBLIC_CHANNEL_ID,
      fullCaption,
    );
    telegramMessageId = result.messageId;
  }

  const publicationId = crypto.randomUUID();
  await publicationRepository.insert({
    id: publicationId,
    offerId,
    channelId: env.TELEGRAM_PUBLIC_CHANNEL_ID,
    telegramMessageId,
    finalCaption: fullCaption,
    finalImageUrl: offer.imageUrl,
    finalAffiliateUrl: offer.affiliateUrl,
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
    payload: { publicationId, telegramMessageId },
  });

  logger.info({ offerId, publicationId, telegramMessageId }, "Offer published");

  return { status: "published", messageId: telegramMessageId };
}
