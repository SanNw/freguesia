import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Logger } from "../../config/logger.js";
import { telegramEnv as env } from "../../config/runtime.js";
import { dispatchProductWatches } from "../../application/product-watch-service.js";
import { AppError } from "../../shared/errors.js";
const input = z
  .object({ limit: z.number().int().min(1).max(20).default(20) })
  .strict();
export function registerProductWatchRoutes(
  app: FastifyInstance,
  logger: Logger,
): void {
  app.post("/v1/product-watches/dispatch", async (request) => {
    if (!env.SHOPPING_ASSISTANT_ENABLED)
      throw new AppError(
        "INVALID_STATE",
        "Shopping assistant is disabled",
        false,
        409,
      );
    const parsed = input.safeParse(request.body ?? {});
    if (!parsed.success)
      throw new AppError(
        "VALIDATION_FAILED",
        "Invalid dispatch parameters",
        false,
        400,
      );
    return dispatchProductWatches(logger, parsed.data.limit);
  });
}
