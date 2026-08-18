import type { Logger } from "../config/logger.js";
import { offerRepository } from "../adapters/persistence/offer-repository.js";
import {
  isAdmin,
  TelegramGateway,
} from "../adapters/telegram/telegram-gateway.js";
import { AppError } from "../shared/errors.js";
import { publishOffer } from "./publish-offer.js";
import { env } from "../config/env.js";
import { approvalRepository } from "../adapters/persistence/repositories.js";

export interface TelegramCallbackInput {
  id: string;
  from: { id: number; username?: string | null };
  data: string;
  message: { message_id: number; chat: { id: number } };
}

export async function handleTelegramCallback(
  callback: TelegramCallbackInput,
  logger: Logger,
): Promise<{ status: string; publicationStatus?: string }> {
  const userId = callback.from.id;
  const gateway = new TelegramGateway(logger);

  if (!isAdmin(userId)) {
    await gateway.answerCallbackQuery(callback.id, "Usuario nao autorizado");
    throw new AppError(
      "UNAUTHORIZED",
      "User not in admin allowlist",
      false,
      403,
    );
  }

  if (String(callback.message.chat.id) !== env.TELEGRAM_APPROVAL_CHAT_ID) {
    await gateway.answerCallbackQuery(
      callback.id,
      "Canal de aprovacao invalido",
    );
    throw new AppError(
      "UNAUTHORIZED",
      "Callback did not originate from the approval chat",
      false,
      403,
    );
  }

  const [prefix, action, offerShortId] = callback.data.split(":");
  if (prefix !== "offer" || !action || !offerShortId) {
    throw new AppError(
      "VALIDATION_FAILED",
      "Invalid callback data format",
      false,
      400,
    );
  }

  const offer = await offerRepository.getByIdShort(offerShortId);
  if (!offer) {
    await gateway.answerCallbackQuery(callback.id, "Oferta nao encontrada");
    throw new AppError("OFFER_NOT_FOUND", "Offer not found", false, 404);
  }

  logger.info(
    { action, offerId: offer.id, userId },
    "Telegram callback received",
  );

  const recordDecision = async (decision: string) =>
    approvalRepository.recordApproval({
      id: crypto.randomUUID(),
      offerId: offer.id,
      decision,
      actorTelegramUserId: String(userId),
      actorUsername: callback.from.username ?? null,
      notes: null,
      payloadBefore: { status: offer.status },
      payloadAfter: null,
      idempotencyKey: `telegram:${callback.id}`,
    });

  switch (action) {
    case "approve": {
      await recordDecision("approve");
      await gateway.answerCallbackQuery(callback.id, "Publicando oferta...");
      await offerRepository.updateStatus(offer.id, "approved");
      try {
        const publication = await publishOffer(
          offer.id,
          `telegram:${callback.id}`,
          logger,
        );
        try {
          await gateway.deleteMessage(
            callback.message.chat.id,
            callback.message.message_id,
          );
        } catch (error) {
          logger.warn(
            { err: error, offerId: offer.id },
            "Published offer approval message could not be deleted",
          );
        }
        return { status: "approved", publicationStatus: publication.status };
      } catch (error) {
        await offerRepository.updateStatus(
          offer.id,
          "pending_approval",
          error instanceof Error ? error.message : "Publication failed",
        );
        throw error;
      }
    }
    case "reject":
      await recordDecision("discard");
      await offerRepository.updateStatus(
        offer.id,
        "rejected",
        "Discarded by admin",
      );
      await gateway.answerCallbackQuery(callback.id, "Oferta descartada");
      return { status: "rejected" };
    case "schedule":
      await recordDecision("schedule");
      await offerRepository.updateStatus(offer.id, "scheduled");
      await gateway.answerCallbackQuery(callback.id, "Oferta agendada");
      return { status: "scheduled" };
    case "revalidate":
      await gateway.answerCallbackQuery(callback.id, "Revalidacao pendente");
      return { status: "revalidation_pending" };
    case "edit":
      await gateway.answerCallbackQuery(
        callback.id,
        "Edicao ainda nao disponivel",
      );
      return { status: "edit_pending" };
    default:
      throw new AppError(
        "VALIDATION_FAILED",
        `Unknown action: ${action}`,
        false,
        400,
      );
  }
}
