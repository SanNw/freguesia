import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Logger } from "../../config/logger.js";
import { publishToPinterest } from "../../application/publish-to-pinterest.js";
import { AppError } from "../../shared/errors.js";

const publishSchema = z.object({ idempotencyKey: z.string().min(1).max(200) });

export function registerPinterestRoutes(app: FastifyInstance, logger: Logger) {
  app.post<{ Params: { offerId: string } }>(
    "/internal/pinterest/offers/:offerId/publish",
    async (request, reply) => {
      const parsed = publishSchema.safeParse(request.body);
      if (!parsed.success) throw new AppError("VALIDATION_FAILED", "Invalid publish body", false, 400);
      reply.send(await publishToPinterest(request.params.offerId, parsed.data.idempotencyKey, logger));
    },
  );
}
