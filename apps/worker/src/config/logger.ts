import pino from "pino";

export function createLogger(service: string, pretty: boolean) {
  const base = {
    service,
    level: process.env.LOG_LEVEL || "info",
  };

  if (pretty) {
    return pino(base, pino.transport({
      target: "pino-pretty",
      options: { colorize: true, translateTime: "SYS:standard" },
    }));
  }

  return pino(base);
}

export type Logger = ReturnType<typeof createLogger>;
