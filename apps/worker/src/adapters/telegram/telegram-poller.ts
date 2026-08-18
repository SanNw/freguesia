import type { Logger } from "../../config/logger.js";
import { env } from "../../config/env.js";
import { handleTelegramCallback } from "../../application/handle-telegram-callback.js";
import { telegramCallbackSchema } from "../../http/schemas/index.js";
import { handleAmazonMessage } from "../../application/handle-amazon-message.js";
import type { AmazonTelegramMessage } from "../../application/handle-amazon-message.js";

export class TelegramPoller {
  private running = false;
  private offset = 0;

  constructor(private readonly logger: Logger) {}

  start(): void {
    if (this.running || !env.TELEGRAM_POLLING_ENABLED) return;
    this.running = true;
    void this.loop();
    this.logger.info("Telegram long polling started");
  }

  stop(): void {
    this.running = false;
  }

  private async loop(): Promise<void> {
    while (this.running) {
      try {
        const apiBase = env.TELEGRAM_BOT_API_BASE.replace(/\/$/, "");
        const url = `${apiBase}/bot${env.TELEGRAM_BOT_TOKEN}/getUpdates`;
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            offset: this.offset,
            timeout: 25,
            allowed_updates: ["callback_query", "message"],
          }),
        });
        const payload = (await response.json()) as {
          ok: boolean;
          result?: unknown[];
          description?: string;
        };
        if (!payload.ok) {
          throw new Error(payload.description ?? "Telegram getUpdates failed");
        }

        for (const rawUpdate of payload.result ?? []) {
          const parsed = telegramCallbackSchema.safeParse(rawUpdate);
          const updateId = (rawUpdate as { update_id?: number }).update_id;
          if (typeof updateId === "number") this.offset = updateId + 1;
          const message = (rawUpdate as { message?: unknown }).message;
          if (
            message &&
            typeof message === "object" &&
            "chat" in message &&
            typeof message.chat === "object" &&
            message.chat !== null &&
            "id" in message.chat
          ) {
            try {
              await handleAmazonMessage(
                message as AmazonTelegramMessage,
                this.logger,
              );
            } catch (error) {
              this.logger.error(
                { err: error },
                "Telegram message processing failed",
              );
            }
          }
          if (!parsed.success) continue;

          try {
            await handleTelegramCallback(
              parsed.data.callback_query,
              this.logger,
            );
          } catch (error) {
            this.logger.error(
              { err: error },
              "Telegram callback processing failed",
            );
          }
        }
      } catch (error) {
        this.logger.warn({ err: error }, "Telegram polling failed; retrying");
        await new Promise((resolve) => setTimeout(resolve, 5_000));
      }
    }
  }
}
