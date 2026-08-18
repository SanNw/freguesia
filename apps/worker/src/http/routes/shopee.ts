import type { FastifyInstance } from "fastify";
import { ShopeeAdapter } from "../../adapters/sources/shopee.adapter.js";

export function registerShopeeRoutes(app: FastifyInstance) {
  app.get("/v1/integrations/shopee/status", async (_request, reply) => {
    const health = await new ShopeeAdapter().healthCheck();
    reply.send({ source: "shopee", ...health });
  });
}
