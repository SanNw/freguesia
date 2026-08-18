import type { FastifyInstance } from "fastify";
import type { Logger } from "../../config/logger.js";
import { AppError } from "../../shared/errors.js";
import {
  completeMercadoLivreAuthorization,
  createMercadoLivreAuthorizationUrl,
  getMercadoLivreAccessToken,
} from "../../adapters/mercadolivre/oauth.js";

export function registerMercadoLivreRoutes(
  app: FastifyInstance,
  logger: Logger,
) {
  app.get(
    "/v1/integrations/mercadolivre/oauth/connect",
    async (_request, reply) => {
      const url = await createMercadoLivreAuthorizationUrl();
      reply.redirect(url);
    },
  );

  app.get<{
    Querystring: { code?: string; state?: string; error?: string };
  }>("/v1/integrations/mercadolivre/oauth/callback", async (request, reply) => {
    if (request.query.error) {
      throw new AppError(
        "SOURCE_AUTH_REQUIRED",
        `Mercado Livre authorization failed: ${request.query.error}`,
        false,
        400,
      );
    }
    if (!request.query.code || !request.query.state) {
      throw new AppError(
        "VALIDATION_FAILED",
        "Missing OAuth code or state",
        false,
        400,
      );
    }
    await completeMercadoLivreAuthorization(
      request.query.code,
      request.query.state,
    );
    logger.info("Mercado Livre OAuth connection completed");
    reply
      .type("text/html; charset=utf-8")
      .send(
        '<!doctype html><html lang="pt-BR"><body><h1>Mercado Livre conectado</h1><p>Você pode fechar esta janela.</p></body></html>',
      );
  });

  app.get(
    "/v1/integrations/mercadolivre/oauth/status",
    async (_request, reply) => {
      try {
        await getMercadoLivreAccessToken();
        reply.send({ connected: true });
      } catch {
        reply.send({ connected: false });
      }
    },
  );
}
