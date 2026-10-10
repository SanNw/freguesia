import type { Logger } from "../config/logger.js";
import { reportEnv as env } from "../config/runtime.js";
import { performanceReportRepository as repository } from "../adapters/persistence/performance-report-repository.js";
import {
  readAwinMetrics,
  readShopeeMetrics,
} from "../adapters/reporting/performance-metrics.js";
import {
  TelegramGateway,
  TelegramMessageRejectedError,
} from "../adapters/telegram/telegram-gateway.js";
import { AppError } from "../shared/errors.js";
import {
  formatPerformanceReport,
  getReportPeriod,
  unavailableMetrics,
  type PerformanceReport,
  type ReportKind,
  type ReportPeriod,
} from "../domain/performance-report.js";

async function collect(period: ReportPeriod, logger: Logger) {
  const sources = await Promise.all(
    [
      ["Awin — lojas parceiras", readAwinMetrics] as const,
      ["Shopee", readShopeeMetrics] as const,
    ].map(async ([name, read]) => {
      try {
        return await read(period);
      } catch (error) {
        logger.warn(
          {
            source: name,
            periodStart: period.startDate,
            errorType: error instanceof Error ? error.name : "unknown",
          },
          "Performance metrics unavailable",
        );
        return unavailableMetrics(
          name,
          "Consulta indisponível; não equivale a zero vendas.",
        );
      }
    }),
  );
  const botActivity = await repository.botActivity(period).catch(() => {
    logger.warn(
      { periodStart: period.startDate },
      "Bot activity metrics unavailable",
    );
    return null;
  });
  return {
    publications: await repository.publications(period),
    sources,
    botActivity,
  };
}

export async function buildPerformanceReport(
  kind: ReportKind,
  logger: Logger,
  now = new Date(),
): Promise<PerformanceReport> {
  const period = getReportPeriod(kind, now);
  const previousPeriod = getReportPeriod(
    kind,
    new Date(`${period.startDate}T12:00:00Z`),
  );
  const [current, previous] = await Promise.all([
    collect(period, logger),
    collect(previousPeriod, logger),
  ]);
  current.sources.push(
    unavailableMetrics(
      "Mercado Livre",
      "Coleta de métricas do portal de afiliados ainda não integrada.",
    ),
  );
  current.sources.push(
    unavailableMetrics(
      "Vitrine Freguesia",
      "Cliques da vitrine ainda não conectados ao relatório; compras são medidas pelas lojas.",
    ),
  );
  return { period, ...current, previous };
}

export async function sendPerformanceReport(
  kind: ReportKind,
  logger: Logger,
  now = new Date(),
) {
  if (!env.PERFORMANCE_REPORTS_ENABLED)
    throw new AppError(
      "VALIDATION_FAILED",
      "Relatórios desativados",
      false,
      503,
    );
  const admins = env.TELEGRAM_ADMIN_USER_IDS.split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const recipient = env.TELEGRAM_REPORT_CHAT_ID || admins[0];
  if (
    !recipient ||
    !/^[1-9]\d*$/.test(recipient) ||
    !admins.includes(recipient)
  ) {
    throw new AppError(
      "VALIDATION_FAILED",
      "O relatório exige um chat privado de administrador autorizado",
      false,
      400,
    );
  }
  const report = await buildPerformanceReport(kind, logger, now);
  const text = formatPerformanceReport(report);
  if (Array.from(text).length > 32768)
    throw new Error("O relatório excede o limite de mensagem do Telegram");
  const key = `${kind}:${report.period.startDate}:${recipient}`;
  if (!(await repository.reserve(key, recipient, report)))
    return { status: "already_reserved", period: report.period };
  try {
    const delivery = await new TelegramGateway(logger).sendRichMessage(
      { chatId: recipient, markdown: text },
      { retryAmbiguousErrors: false },
    );
    await repository.markSent(key, delivery.messageId);
    return {
      status: "sent",
      messageId: delivery.messageId,
      period: report.period,
    };
  } catch (error) {
    if (error instanceof TelegramMessageRejectedError) {
      await repository.releaseRejected(key);
      throw error;
    }
    // A timeout can happen after Telegram accepts the message; reserve it for manual reconciliation.
    await repository.markUnknown(key);
    throw error;
  }
}
