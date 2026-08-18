import Fastify from "fastify";
import cors from "@fastify/cors";
import type { Logger } from "./config/logger.js";
import { env } from "./config/env.js";
import { serviceTokenAuth } from "./http/middleware/auth.js";
import { registerHealthRoutes } from "./http/routes/health.js";
import { registerDiscoveryRoutes } from "./http/routes/discovery.js";
import { registerOfferRoutes } from "./http/routes/offers.js";
import { registerTelegramRoutes } from "./http/routes/telegram.js";
import { registerMercadoLivreRoutes } from "./http/routes/mercadolivre.js";
import { registerMaintenanceRoutes } from "./http/routes/maintenance.js";
import { registerShopeeRoutes } from "./http/routes/shopee.js";
import { registerAliExpressRoutes } from "./http/routes/aliexpress.js";
import { AppError } from "./shared/errors.js";

export async function buildApp(logger: Logger) {
  const app = Fastify({
    logger: false,
    bodyLimit: env.WORKER_BODY_LIMIT_BYTES,
    requestTimeout: env.WORKER_REQUEST_TIMEOUT_MS,
  });

  await app.register(cors, {
    origin: env.WORKER_ALLOWED_ORIGINS
      ? env.WORKER_ALLOWED_ORIGINS.split(",").map((s) => s.trim())
      : false,
  });

  app.addHook("preHandler", serviceTokenAuth);

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      reply.code(error.statusCode).send(error.toJSON());
      return;
    }
    logger.error({ err: error }, "Unhandled error");
    reply.code(500).send({
      error: {
        code: "INTERNAL_ERROR",
        message: "Internal server error",
        retryable: false,
        details: {},
      },
    });
  });

  registerHealthRoutes(app, logger);
  registerDiscoveryRoutes(app, logger);
  registerOfferRoutes(app, logger);
  registerTelegramRoutes(app, logger);
  registerMercadoLivreRoutes(app, logger);
  registerMaintenanceRoutes(app, logger);
  registerShopeeRoutes(app);
  registerAliExpressRoutes(app);

  return app;
}
