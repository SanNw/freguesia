import type { FastifyInstance } from "fastify";
import type { Logger } from "../../config/logger.js";
import { telegramCallbackSchema } from "../schemas/index.js";
import { isAdmin } from "../../adapters/telegram/telegram-gateway.js";
import { AppError } from "../../shared/errors.js";
import { offerRepository } from "../../adapters/persistence/offer-repository.js";

export function registerTelegramRoutes(app: FastifyInstance, logger: Logger) {
  app.post("/v1/telegram/callback", async (request, reply) => {
    const parsed = telegramCallbackSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(
        "VALIDATION_FAILED",
        "Invalid Telegram callback",
        false,
        400,
      );
    }

    const { callback_query } = parsed.data;
    const userId = callback_query.from.id;

    if (!isAdmin(userId)) {
      logger.warn({ userId }, "Unauthorized callback attempt");
      throw new AppError(
        "UNAUTHORIZED",
        "User not in admin allowlist",
        false,
        403,
      );
    }

    const data = callback_query.data;
    const parts = data.split(":");
    if (parts.length < 3 || parts[0] !== "offer") {
      throw new AppError(
        "VALIDATION_FAILED",
        "Invalid callback data format",
        false,
        400,
      );
    }

    const action = parts[1];
    const offerShortId = parts[2];
    const offer = await offerRepository.getOffer(offerShortId);

    if (!offer) {
      throw new AppError("OFFER_NOT_FOUND", "Offer not found", false, 404);
    }

    logger.info(
      { action, offerId: offerShortId, userId },
      "Telegram callback received",
    );

    switch (action) {
      case "approve":
        await offerRepository.updateStatus(offerShortId, "approved");
        break;
      case "reject":
        await offerRepository.updateStatus(
          offerShortId,
          "rejected",
          "Discarded by admin",
        );
        break;
      case "revalidate":
        logger.info(
          { offerId: offerShortId },
          "Revalidation requested via callback",
        );
        break;
      case "edit":
        logger.info({ offerId: offerShortId }, "Edit requested via callback");
        break;
      case "schedule":
        await offerRepository.updateStatus(offerShortId, "scheduled");
        break;
      default:
        throw new AppError(
          "VALIDATION_FAILED",
          `Unknown action: ${action}`,
          false,
          400,
        );
    }

    reply.send({ status: "ok" });
  });
}
