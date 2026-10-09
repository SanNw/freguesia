import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  config: {
    PERFORMANCE_REPORTS_ENABLED: true,
    TELEGRAM_REPORT_CHAT_ID: "",
    TELEGRAM_ADMIN_USER_IDS: "123",
  },
  reserved: new Set<string>(),
  messages: [] as Array<{ chat: string; text: string; options: unknown }>,
  failSend: false,
  rejectSend: false,
  unknown: new Set<string>(),
}));
vi.mock("../../src/config/runtime.js", () => ({ reportEnv: state.config }));
vi.mock(
  "../../src/adapters/persistence/performance-report-repository.js",
  () => ({
    performanceReportRepository: {
      publications: async () => [{ channel: "Moda", count: 3 }],
      reserve: async (key: string) => {
        if (state.reserved.has(key)) return false;
        state.reserved.add(key);
        return true;
      },
      markSent: async () => {},
      markUnknown: async (key: string) => {
        state.unknown.add(key);
      },
      releaseRejected: async (key: string) => {
        state.reserved.delete(key);
      },
    },
  }),
);
vi.mock("../../src/adapters/reporting/performance-metrics.js", () => ({
  readAwinMetrics: async () => {
    throw new Error("API unavailable");
  },
  readShopeeMetrics: async () => {
    throw new Error("API unavailable");
  },
}));
vi.mock("../../src/adapters/telegram/telegram-gateway.js", () => {
  class TelegramMessageRejectedError extends Error {}
  return {
    TelegramMessageRejectedError,
    TelegramGateway: class {
      async sendRichMessage(
        input: { chatId: string; markdown: string },
        options: unknown,
      ) {
        if (state.failSend) throw new Error("network timeout");
        if (state.rejectSend)
          throw new TelegramMessageRejectedError("Forbidden");
        state.messages.push({
          chat: input.chatId,
          text: input.markdown,
          options,
        });
        return { messageId: 42 };
      }
    },
  };
});

import { sendPerformanceReport } from "../../src/application/send-performance-report.js";
const logger = { warn: () => {}, info: () => {} } as never;
const now = new Date("2026-10-09T12:00:00Z");

beforeEach(() => {
  state.reserved.clear();
  state.messages.length = 0;
  state.unknown.clear();
  state.failSend = false;
  state.rejectSend = false;
  state.config.TELEGRAM_REPORT_CHAT_ID = "";
});

describe("private report delivery", () => {
  it("allows a new attempt after Telegram explicitly refuses the message", async () => {
    state.rejectSend = true;
    await expect(sendPerformanceReport("monthly", logger, now)).rejects.toThrow(
      "Forbidden",
    );
    expect(state.reserved.size).toBe(0);
    state.rejectSend = false;
    expect(await sendPerformanceReport("monthly", logger, now)).toMatchObject({
      status: "sent",
    });
    expect(state.messages).toHaveLength(1);
  });
  it("sends one private report even when the scheduler submits the period twice", async () => {
    const results = await Promise.all([
      sendPerformanceReport("weekly", logger, now),
      sendPerformanceReport("weekly", logger, now),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([
      "already_reserved",
      "sent",
    ]);
    expect(state.messages).toHaveLength(1);
    expect(state.messages[0]).toMatchObject({
      chat: "123",
      options: { retryAmbiguousErrors: false },
    });
    expect(state.messages[0].text).toContain("Sem métricas:");
  });

  it("rejects group IDs and recipients outside the administrator allowlist", async () => {
    for (const chat of ["-100123", "999"]) {
      state.config.TELEGRAM_REPORT_CHAT_ID = chat;
      await expect(
        sendPerformanceReport("weekly", logger, now),
      ).rejects.toThrow(/privado|administrador/i);
    }
    expect(state.messages).toHaveLength(0);
  });

  it("does not send again after an ambiguous delivery failure", async () => {
    state.failSend = true;
    await expect(sendPerformanceReport("weekly", logger, now)).rejects.toThrow(
      "network timeout",
    );
    expect(state.unknown.size).toBe(1);
    state.failSend = false;
    expect(await sendPerformanceReport("weekly", logger, now)).toMatchObject({
      status: "already_reserved",
    });
    expect(state.messages).toHaveLength(0);
  });
});
