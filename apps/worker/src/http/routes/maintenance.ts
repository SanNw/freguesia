import type { FastifyInstance } from "fastify";
import type { Logger } from "../../config/logger.js";
import { runMaintenanceCleanup } from "../../application/run-maintenance-cleanup.js";

export function registerMaintenanceRoutes(
  app: FastifyInstance,
  logger: Logger,
) {
  app.post("/v1/maintenance/cleanup", async (_request, reply) => {
    reply.send({
      status: "completed",
      ...(await runMaintenanceCleanup(logger)),
    });
  });
}
