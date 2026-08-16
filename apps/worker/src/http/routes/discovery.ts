import type { FastifyInstance } from "fastify";
import type { Logger } from "../../config/logger.js";
import { createDiscoveryRunSchema } from "../schemas/index.js";
import { AppError } from "../../shared/errors.js";

export function registerDiscoveryRoutes(app: FastifyInstance, logger: Logger) {
  app.post("/v1/discovery-runs", async (request, reply) => {
    const parsed = createDiscoveryRunSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(
        "VALIDATION_FAILED",
        "Invalid request body",
        false,
        400,
        parsed.error.flatten().fieldErrors as Record<string, unknown>,
      );
    }

    const runId = crypto.randomUUID();
    logger.info(
      { runId, sourceSlug: parsed.data.sourceSlug },
      "Discovery run accepted",
    );

    reply.code(202).send({ runId, status: "accepted" });
  });

  app.get<{ Params: { runId: string } }>(
    "/v1/discovery-runs/:runId",
    async (request, reply) => {
      const { runId } = request.params;
      logger.debug({ runId }, "Discovery run status requested");
      reply.send({ runId, status: "pending" });
    },
  );
}
