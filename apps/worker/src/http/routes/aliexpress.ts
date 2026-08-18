import type { FastifyInstance } from "fastify";
import { AliExpressAdapter } from "../../adapters/sources/aliexpress.adapter.js";

export function registerAliExpressRoutes(app: FastifyInstance) {
  app.get("/v1/integrations/aliexpress/status", async (_request, reply) => {
    const health = await new AliExpressAdapter().healthCheck();
    reply.send({ source: "aliexpress", ...health });
  });
}
