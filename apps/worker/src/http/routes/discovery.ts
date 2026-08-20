import type { FastifyInstance } from "fastify";
import type { Logger } from "../../config/logger.js";
import { createDiscoveryRunSchema } from "../schemas/index.js";
import { AppError } from "../../shared/errors.js";
import { runLomadeeDiscovery } from "../../application/run-lomadee-discovery.js";
import { runMercadoLivreDiscovery } from "../../application/run-mercadolivre-discovery.js";
import { runShopeeDiscovery } from "../../application/run-shopee-discovery.js";
import { runAliExpressDiscovery } from "../../application/run-aliexpress-discovery.js";

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

    if (parsed.data.sourceSlug === "lomadee") {
      const result = await runLomadeeDiscovery(
        {
          query: parsed.data.query,
          category: parsed.data.category,
          limit: parsed.data.limit,
          correlationId: parsed.data.correlationId ?? runId,
        },
        logger,
      );
      reply.send({ runId, ...result });
      return;
    }

    if (parsed.data.sourceSlug === "mercadolivre") {
      const result = await runMercadoLivreDiscovery(
        {
          query: parsed.data.query,
          category: parsed.data.category,
          limit: parsed.data.limit,
          correlationId: parsed.data.correlationId ?? runId,
        },
        logger,
      );
      reply.send({ runId, ...result });
      return;
    }

    if (parsed.data.sourceSlug === "shopee") {
      reply.send({
        runId,
        ...(await runShopeeDiscovery(
          {
            query: parsed.data.query,
            limit: parsed.data.limit,
            correlationId: parsed.data.correlationId ?? runId,
          },
          logger,
        )),
      });
      return;
    }

    if (parsed.data.sourceSlug === "aliexpress") {
      reply.send({
        runId,
        ...(await runAliExpressDiscovery(
          {
            query: parsed.data.query,
            category: parsed.data.category,
            limit: parsed.data.limit,
            correlationId: parsed.data.correlationId ?? runId,
          },
          logger,
        )),
      });
      return;
    }

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
