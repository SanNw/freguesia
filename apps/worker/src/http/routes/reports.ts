import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Logger } from "../../config/logger.js";
import {
  buildPerformanceReport,
  sendPerformanceReport,
} from "../../application/send-performance-report.js";
import { formatPerformanceReport } from "../../domain/performance-report.js";
import { AppError } from "../../shared/errors.js";

const input = z
  .object({
    period: z.enum(["weekly", "monthly"]),
    referenceDate: z.string().datetime({ offset: true }).optional(),
  })
  .strict();

export function registerReportRoutes(app: FastifyInstance, logger: Logger) {
  app.get("/v1/reports/performance", async (request) => {
    const parsed = input.safeParse(request.query);
    if (!parsed.success)
      throw new AppError(
        "VALIDATION_FAILED",
        "Invalid report parameters",
        false,
        400,
      );
    const report = await buildPerformanceReport(
      parsed.data.period,
      logger,
      parsed.data.referenceDate
        ? new Date(parsed.data.referenceDate)
        : undefined,
    );
    return { ...report, text: formatPerformanceReport(report) };
  });
  app.post("/v1/reports/performance/send", async (request) => {
    const parsed = input.safeParse(request.body);
    if (!parsed.success)
      throw new AppError(
        "VALIDATION_FAILED",
        "Invalid report parameters",
        false,
        400,
      );
    return sendPerformanceReport(
      parsed.data.period,
      logger,
      parsed.data.referenceDate
        ? new Date(parsed.data.referenceDate)
        : undefined,
    );
  });
}
