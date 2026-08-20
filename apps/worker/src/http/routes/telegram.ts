import type { FastifyInstance } from "fastify";
import type { Logger } from "../../config/logger.js";
import { telegramCallbackSchema } from "../schemas/index.js";
import { AppError } from "../../shared/errors.js";
import { handleTelegramCallback } from "../../application/handle-telegram-callback.js";
import { telegramEnv as env } from "../../config/runtime.js";

function validWebhookSecret(value: string | string[] | undefined): boolean {
  if (!env.TELEGRAM_WEBHOOK_SECRET) return false;
  const provided = Buffer.from(
    Array.isArray(value) ? (value[0] ?? "") : (value ?? ""),
  );
  const expected = Buffer.from(env.TELEGRAM_WEBHOOK_SECRET);
  return (
    provided.length === expected.length && timingSafeEqual(provided, expected)
  );
}

export function registerTelegramRoutes(app: FastifyInstance, logger: Logger) {
  app.post("/v1/telegram/callback", async (request, reply) => {
    if (
      !validWebhookSecret(request.headers["x-telegram-bot-api-secret-token"])
    ) {
      throw new AppError(
        "UNAUTHORIZED",
        "Invalid Telegram webhook secret",
        false,
        401,
      );
    }
    const parsed = telegramCallbackSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(
        "VALIDATION_FAILED",
        "Invalid Telegram callback",
        false,
        400,
      );
    }

    const result = await handleTelegramCallback(
      parsed.data.callback_query,
      logger,
    );
    reply.send(result);
  });
}
import { timingSafeEqual } from "node:crypto";
