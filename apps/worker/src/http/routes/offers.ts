import type { FastifyInstance } from "fastify";
import type { Logger } from "../../config/logger.js";
import { offerRepository } from "../../adapters/persistence/offer-repository.js";
import { approveSchema, revalidateSchema, publishSchema } from "../schemas/index.js";
import { AppError } from "../../shared/errors.js";
import { publishOffer } from "../../application/publish-offer.js";

export function registerOfferRoutes(
  app: FastifyInstance,
  logger: Logger,
) {
  app.get<{ Params: { offerId: string } }>(
    "/v1/offers/:offerId",
    async (request, reply) => {
      const offer = await offerRepository.getOffer(request.params.offerId);
      if (!offer) {
        throw new AppError("OFFER_NOT_FOUND", "Offer not found", false, 404);
      }
      reply.send(offer);
    },
  );

  app.post<{ Params: { offerId: string } }>(
    "/v1/offers/:offerId/revalidate",
    async (request, reply) => {
      revalidateSchema.parse(request.body);
      logger.info({ offerId: request.params.offerId }, "Revalidation requested");
      reply.send({ status: "pending" });
    },
  );

  app.post<{ Params: { offerId: string } }>(
    "/v1/offers/:offerId/approve",
    async (request, reply) => {
      const parsed = approveSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new AppError("VALIDATION_FAILED", "Invalid approval body", false, 400);
      }
      const { offerId } = request.params;
      const offer = await offerRepository.getOffer(offerId);
      if (!offer) {
        throw new AppError("OFFER_NOT_FOUND", "Offer not found", false, 404);
      }
      await offerRepository.updateStatus(offerId, "approved");
      logger.info({ offerId, actor: parsed.data.actorTelegramUserId }, "Offer approved");
      reply.send({ status: "approved" });
    },
  );

  app.post<{ Params: { offerId: string } }>(
    "/v1/offers/:offerId/publish",
    async (request, reply) => {
      const parsed = publishSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new AppError("VALIDATION_FAILED", "Invalid publish body", false, 400);
      }
      const result = await publishOffer(request.params.offerId, parsed.data.idempotencyKey, logger);
      reply.send(result);
    },
  );
}
