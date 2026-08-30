import type { Logger } from "../config/logger.js";
import { offerRepository } from "../adapters/persistence/offer-repository.js";
import {
  isAdmin,
  TelegramGateway,
} from "../adapters/telegram/telegram-gateway.js";
import { AppError } from "../shared/errors.js";
import { telegramEnv as env } from "../config/runtime.js";
import { approvalRepository } from "../adapters/persistence/repositories.js";
import { parseEditCommand } from "./telegram-update.js";
import type { ProductNiche } from "../domain/product-niche.js";

const CHANNEL_NICHES = new Set<ProductNiche>([
  "hardware",
  "electronics",
  "appliances",
  "home_kitchen",
  "beauty",
  "fashion",
  "general",
]);

export interface TelegramEditMessage {
  from?: { id: number; username?: string | null };
  chat: { id: number };
  text?: string;
}

export async function handleTelegramEditMessage(
  message: TelegramEditMessage,
  logger: Logger,
): Promise<boolean> {
  if (!message.text?.startsWith("/editar")) return false;
  const gateway = new TelegramGateway(logger);
  if (
    !message.from ||
    !isAdmin(message.from.id) ||
    String(message.chat.id) !== env.TELEGRAM_APPROVAL_CHAT_ID
  ) {
    return true;
  }
  const edit = parseEditCommand(message.text);
  if (!edit) {
    await gateway.sendMessage(
      String(message.chat.id),
      "Formato: /editar ID_DA_OFERTA\nNova legenda",
    );
    return true;
  }
  const updated = await offerRepository.updatePendingCaption(
    edit.offerId,
    edit.caption,
  );
  await gateway.sendMessage(
    String(message.chat.id),
    updated
      ? "Legenda atualizada. Agora voce pode aprovar."
      : "Oferta nao encontrada ou ja processada.",
  );
  return true;
}

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

  const parts = callback.data.split(":");
  const [prefix, action] = parts;
  const channelChoice = action === "channel" ? parts[2] : undefined;
  const offerShortId = action === "channel" ? parts[3] : parts[2];
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

  if (action === "channel") {
    if (!channelChoice) {
      throw new AppError(
        "VALIDATION_FAILED",
        "Missing publication channel choice",
        false,
        400,
      );
    }
    if (channelChoice === "discard") {
      const discarded = await offerRepository.transitionStatus(
        offer.id,
        ["pending_approval"],
        "rejected",
        "Discarded by admin",
      );
      if (!discarded) {
        await gateway.answerCallbackQuery(callback.id, "Oferta ja processada");
        return { status: "already_processed" };
      }
      await recordDecision("discard");
      await gateway.answerCallbackQuery(callback.id, "Oferta descartada");
      return { status: "rejected" };
    }
    if (!CHANNEL_NICHES.has(channelChoice as ProductNiche)) {
      throw new AppError(
        "VALIDATION_FAILED",
        `Unknown publication channel: ${channelChoice}`,
        false,
        400,
      );
    }
    const selected = await offerRepository.setPublicationNiche(
      offer.id,
      channelChoice as ProductNiche,
      "manual",
      ["pending_approval"],
    );
    if (!selected) {
      await gateway.answerCallbackQuery(callback.id, "Oferta ja processada");
      return { status: "already_processed" };
    }
    await recordDecision(`channel:${channelChoice}`);
    await gateway.answerCallbackQuery(
      callback.id,
      "Canal escolhido e oferta adicionada a fila",
    );
    try {
      await gateway.deleteMessage(
        callback.message.chat.id,
        callback.message.message_id,
      );
    } catch (error) {
      logger.warn(
        { err: error, offerId: offer.id },
        "Channel approval message could not be deleted",
      );
    }
    return { status: "scheduled" };
  }

  switch (action) {
    case "approve": {
      const claimed = await offerRepository.transitionStatus(
        offer.id,
        ["pending_approval"],
        "scheduled",
      );
      if (!claimed) {
        await gateway.answerCallbackQuery(callback.id, "Oferta ja processada");
        return { status: "already_processed" };
      }
      await recordDecision("approve");
      await gateway.answerCallbackQuery(
        callback.id,
        "Oferta aprovada e adicionada à fila",
      );
      try {
        await gateway.deleteMessage(
          callback.message.chat.id,
          callback.message.message_id,
        );
      } catch (error) {
        logger.warn(
          { err: error, offerId: offer.id },
          "Queued offer approval message could not be deleted",
        );
      }
      return { status: "scheduled" };
    }
    case "reject":
      if (
        !(await offerRepository.transitionStatus(
          offer.id,
          ["pending_approval"],
          "rejected",
          "Discarded by admin",
        ))
      ) {
        await gateway.answerCallbackQuery(callback.id, "Oferta ja processada");
        return { status: "already_processed" };
      }
      await recordDecision("discard");
      await gateway.answerCallbackQuery(callback.id, "Oferta descartada");
      return { status: "rejected" };
    case "schedule":
      if (
        !(await offerRepository.transitionStatus(
          offer.id,
          ["pending_approval"],
          "scheduled",
        ))
      ) {
        await gateway.answerCallbackQuery(callback.id, "Oferta ja processada");
        return { status: "already_processed" };
      }
      await recordDecision("schedule");
      await gateway.answerCallbackQuery(callback.id, "Oferta agendada");
      return { status: "scheduled" };
    case "revalidate":
      await gateway.answerCallbackQuery(callback.id, "Revalidacao pendente");
      return { status: "revalidation_pending" };
    case "edit":
      await gateway.answerCallbackQuery(
        callback.id,
        "Enviei as instrucoes de edicao",
      );
      await gateway.sendMessage(
        String(callback.message.chat.id),
        `Para editar a legenda, envie:\n\n/editar ${offer.id}\nNova legenda da promocao`,
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
