import type { FastifyInstance } from "fastify";
import type { Logger } from "../../config/logger.js";
import { offerRepository } from "../../adapters/persistence/offer-repository.js";
import {
  approveSchema,
  revalidateSchema,
  publishSchema,
  createManualOfferSchema,
  listOffersQuerySchema,
} from "../schemas/index.js";
import { AppError } from "../../shared/errors.js";
import { publishOffer } from "../../application/publish-offer.js";
import { createManualOffer } from "../../application/create-manual-offer.js";
import { requestApproval } from "../../application/request-approval.js";

export function registerOfferRoutes(app: FastifyInstance, logger: Logger) {
  app.post("/v1/offers", async (request, reply) => {
    const parsed = createManualOfferSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(
        "VALIDATION_FAILED",
        "Invalid offer body",
        false,
        400,
        parsed.error.flatten().fieldErrors as Record<string, unknown>,
      );
    }
    const result = await createManualOffer(parsed.data, logger);
    reply.code(201).send(result);
  });

  app.get("/v1/offers", async (request, reply) => {
    const parsed = listOffersQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      throw new AppError(
        "VALIDATION_FAILED",
        "Invalid query params",
        false,
        400,
      );
    }
    const offers = await offerRepository.listOffers(
      parsed.data.status,
      parsed.data.limit,
      parsed.data.offset,
    );
    reply.send({ offers, count: offers.length });
  });

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
    "/v1/offers/:offerId/request-approval",
    async (request, reply) => {
      const result = await requestApproval(request.params.offerId, logger);
      reply.send(result);
    },
  );

  app.post<{ Params: { offerId: string } }>(
    "/v1/offers/:offerId/revalidate",
    async (request, reply) => {
      revalidateSchema.parse(request.body);
      logger.info(
        { offerId: request.params.offerId },
        "Revalidation requested",
      );
      reply.send({ status: "pending" });
    },
  );

  app.post<{ Params: { offerId: string } }>(
    "/v1/offers/:offerId/approve",
    async (request, reply) => {
      const parsed = approveSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new AppError(
          "VALIDATION_FAILED",
          "Invalid approval body",
          false,
          400,
        );
      }
      const { offerId } = request.params;
      const offer = await offerRepository.getOffer(offerId);
      if (!offer) {
        throw new AppError("OFFER_NOT_FOUND", "Offer not found", false, 404);
      }
      await offerRepository.updateStatus(offerId, "approved");
      logger.info(
        { offerId, actor: parsed.data.actorTelegramUserId },
        "Offer approved",
      );
      reply.send({ status: "approved" });
    },
  );

  app.post<{ Params: { offerId: string } }>(
    "/v1/offers/:offerId/publish",
    async (request, reply) => {
      const parsed = publishSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new AppError(
          "VALIDATION_FAILED",
          "Invalid publish body",
          false,
          400,
        );
      }
      const result = await publishOffer(
        request.params.offerId,
        parsed.data.idempotencyKey,
        logger,
      );
      reply.send(result);
    },
  );
}
