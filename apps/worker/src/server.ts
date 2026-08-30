import "dotenv/config";
import { createLogger } from "./config/logger.js";
import { appEnv as env } from "./config/runtime.js";
import { buildApp } from "./app.js";
import { db } from "./adapters/persistence/db.js";
import { browserPool } from "./adapters/browser/browser-pool.js";
import { TelegramPoller } from "./adapters/telegram/telegram-poller.js";
import { processNextScheduledOffer } from "./application/process-scheduled-offer.js";
import { createScheduledPublicationRunner } from "./application/scheduled-publication-runner.js";

async function main() {
  const logger = createLogger(env.APP_NAME, env.LOG_PRETTY);

  const app = await buildApp(logger);
  const telegramPoller = new TelegramPoller(logger);
  const scheduledRunner = createScheduledPublicationRunner(() =>
    processNextScheduledOffer(logger),
  );

  app.addHook("onClose", async () => {
    telegramPoller.stop();
    scheduledRunner.stop();
    await db.close();
    await browserPool.close();
  });

  try {
    await app.listen({ host: env.WORKER_HOST, port: env.WORKER_PORT });
    logger.info(
      { host: env.WORKER_HOST, port: env.WORKER_PORT, env: env.APP_ENV },
      "Freguesia Worker started",
    );
    telegramPoller.start();
    scheduledRunner.start();
  } catch (e) {
    logger.error(e, "Failed to start server");
    process.exit(1);
  }

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Shutdown signal received");
    await app.close();
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((e) => {
  console.error("Fatal error during startup:", e);
  process.exit(1);
});
