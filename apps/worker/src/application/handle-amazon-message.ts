import type { Logger } from "../config/logger.js";
import {
  isAdmin,
  TelegramGateway,
} from "../adapters/telegram/telegram-gateway.js";
import { createManualOffer } from "./create-manual-offer.js";
import { requestApproval } from "./request-approval.js";
import { parseAmazonCommand } from "./amazon-command.js";

export interface AmazonTelegramMessage {
  chat: { id: number };
  from?: { id: number };
  text?: string;
}

export async function handleAmazonMessage(
  message: AmazonTelegramMessage,
  logger: Logger,
): Promise<void> {
  if (!message.text?.trim().toLowerCase().startsWith("/amazon")) return;
  const gateway = new TelegramGateway(logger);
  if (!message.from || !isAdmin(message.from.id)) {
    await gateway.sendMessage(
      String(message.chat.id),
      "Usuario nao autorizado.",
    );
    return;
  }

  try {
    const input = parseAmazonCommand(message.text);
    const result = await createManualOffer(input, logger);
    if (result.status !== "pending_approval") {
      await gateway.sendMessage(
        String(message.chat.id),
        `Oferta criada com status: ${result.status}.`,
      );
      return;
    }
    await requestApproval(result.offerId, logger);
    await gateway.sendMessage(
      String(message.chat.id),
      "Oferta da Amazon criada e enviada para aprovacao.",
    );
  } catch (error) {
    const messageText = error instanceof Error ? error.message : String(error);
    logger.warn({ err: error }, "Amazon Telegram command failed");
    await gateway.sendMessage(
      String(message.chat.id),
      `Nao foi possivel criar a oferta: ${messageText}`,
    );
  }
}
