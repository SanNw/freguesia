import type { FastifyInstance } from "fastify";
import type { Logger } from "../../config/logger.js";
import { db } from "../../adapters/persistence/db.js";

export function registerHealthRoutes(app: FastifyInstance, logger: Logger) {
  app.get("/health", async (_req, reply) => {
    reply.send({ status: "ok" });
  });

  app.get("/ready", async (_req, reply) => {
    const checks: Record<string, boolean> = {};

    try {
      checks.database = await db.healthCheck();
    } catch {
      checks.database = false;
    }

    const allHealthy = Object.values(checks).every(Boolean);
    if (!allHealthy) {
      logger.warn({ checks }, "Readiness check failed");
      reply.code(503).send({ status: "not_ready", checks });
      return;
    }

    reply.send({ status: "ready", checks });
  });
}
