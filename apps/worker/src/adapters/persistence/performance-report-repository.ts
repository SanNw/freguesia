import { db } from "./db.js";
import { telegramEnv } from "../../config/runtime.js";
import {
  productNicheLabel,
  type ProductNiche,
} from "../../domain/product-niche.js";
import type {
  PerformanceReport,
  ReportPeriod,
} from "../../domain/performance-report.js";

export const performanceReportsSchema = `CREATE TABLE IF NOT EXISTS performance_reports (
  report_key TEXT PRIMARY KEY,
  recipient_chat_id TEXT NOT NULL,
  period_kind TEXT NOT NULL CHECK (period_kind IN ('weekly', 'monthly')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  report_data JSONB NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sending', 'sent', 'unknown')),
  telegram_message_id BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ
)`;

export const performanceReportRepository = {
  async publications(
    period: ReportPeriod,
  ): Promise<Array<{ channel: string; count: number }>> {
    const rows = await db.query<{ channel_id: string; count: string }>(
      `SELECT channel_id, COUNT(*) AS count FROM publications
       WHERE status = 'published' AND published_at >= $1 AND published_at < $2
       GROUP BY channel_id ORDER BY count DESC, channel_id`,
      [period.startIso, period.endExclusiveIso],
    );
    const channels: Array<[ProductNiche, string]> = [
      ["general", telegramEnv.TELEGRAM_PUBLIC_CHANNEL_ID],
      ["hardware", telegramEnv.TELEGRAM_CHANNEL_HARDWARE_ID],
      ["home_kitchen", telegramEnv.TELEGRAM_CHANNEL_HOME_KITCHEN_ID],
      ["appliances", telegramEnv.TELEGRAM_CHANNEL_APPLIANCES_ID],
      ["beauty", telegramEnv.TELEGRAM_CHANNEL_BEAUTY_ID],
      ["electronics", telegramEnv.TELEGRAM_CHANNEL_ELECTRONICS_ID],
      ["fashion", telegramEnv.TELEGRAM_CHANNEL_FASHION_ID],
    ];
    return rows.map((row) => ({
      channel: productNicheLabel(
        channels.find(([, id]) => id === row.channel_id)?.[0] ?? "general",
      ),
      count: Number(row.count),
    }));
  },
  async reserve(
    key: string,
    recipient: string,
    report: PerformanceReport,
  ): Promise<boolean> {
    const rows = await db.query<{ report_key: string }>(
      `INSERT INTO performance_reports (report_key, recipient_chat_id, period_kind, period_start, period_end, report_data, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'sending') ON CONFLICT DO NOTHING RETURNING report_key`,
      [
        key,
        recipient,
        report.period.kind,
        report.period.startDate,
        report.period.endDate,
        JSON.stringify(report),
      ],
    );
    return rows.length === 1;
  },
  async markSent(key: string, messageId: number): Promise<void> {
    await db.query(
      `UPDATE performance_reports SET status = 'sent', telegram_message_id = $2, sent_at = NOW() WHERE report_key = $1`,
      [key, messageId],
    );
  },
  async markUnknown(key: string): Promise<void> {
    await db.query(
      `UPDATE performance_reports SET status = 'unknown' WHERE report_key = $1 AND status = 'sending'`,
      [key],
    );
  },

  async releaseRejected(key: string): Promise<void> {
    await db.query(
      `DELETE FROM performance_reports WHERE report_key = $1 AND status = 'sending'`,
      [key],
    );
  },
};
