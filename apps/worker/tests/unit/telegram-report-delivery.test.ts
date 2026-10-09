import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("../../src/config/runtime.js", () => ({
  telegramEnv: {
    TELEGRAM_BOT_API_BASE: "https://api.telegram.org",
    TELEGRAM_BOT_TOKEN: "test",
    TELEGRAM_PARSE_MODE: "MarkdownV2",
  },
}));
import { TelegramGateway } from "../../src/adapters/telegram/telegram-gateway.js";
afterEach(() => vi.unstubAllGlobals());

describe("report Telegram transport", () => {
  it("distinguishes an explicit Telegram rejection from an uncertain timeout", async () => {
    vi.stubGlobal("fetch", async () =>
      Response.json(
        { ok: false, error_code: 403, description: "Forbidden" },
        { status: 403 },
      ),
    );
    await expect(
      new TelegramGateway({} as never).sendRichMessage(
        { chatId: "123", markdown: "# Relatório" },
        { retryAmbiguousErrors: false },
      ),
    ).rejects.toMatchObject({ name: "TelegramMessageRejectedError" });
  });
  it("uses the native rich_message payload with a real footer", async () => {
    const requests: Record<string, unknown>[] = [];
    vi.stubGlobal("fetch", async (_url: unknown, init: RequestInit) => {
      requests.push(JSON.parse(String(init.body)));
      return Response.json({ ok: true, result: { message_id: 5 } });
    });
    const result = await new TelegramGateway({} as never).sendRichMessage(
      { chatId: "123", markdown: "# Relatório", footer: "Dados oficiais" },
      { retryAmbiguousErrors: false },
    );
    expect(result).toEqual({ messageId: 5 });
    expect(requests).toEqual([
      {
        chat_id: "123",
        rich_message: {
          markdown: "# Relatório\n\n<footer>Dados oficiais</footer>",
        },
      },
    ]);
  });

  it("does not retry an ambiguous network failure", async () => {
    let requests = 0;
    vi.stubGlobal("fetch", async () => {
      requests++;
      throw new Error("timeout");
    });
    await expect(
      new TelegramGateway({ warn: () => {} } as never).sendRichMessage(
        { chatId: "123", markdown: "# Relatório" },
        { retryAmbiguousErrors: false },
      ),
    ).rejects.toThrow("timeout");
    expect(requests).toBe(1);
  });
});
