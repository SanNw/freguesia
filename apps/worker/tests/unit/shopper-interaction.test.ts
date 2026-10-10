import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  answer: vi.fn(),
  ephemeral: vi.fn(),
  edit: vi.fn(),
  send: vi.fn(),
  origin: vi.fn(),
  started: vi.fn(),
  remove: vi.fn(),
  list: vi.fn(),
  sessionGet: vi.fn(),
  sessionSet: vi.fn(),
}));
vi.mock("../../src/config/runtime.js", () => ({
  telegramEnv: {
    SHOPPING_ASSISTANT_ENABLED: true,
    TELEGRAM_BOT_USERNAME: "freguesiapromobot",
  },
}));
vi.mock("../../src/adapters/telegram/telegram-gateway.js", () => ({
  TelegramGateway: class {
    answerCallbackQuery = mocks.answer;
    sendEphemeralRichMessage = mocks.ephemeral;
    editRichMessage = mocks.edit;
    sendRichMessage = mocks.send;
  },
}));
vi.mock("../../src/adapters/persistence/product-watch-repository.js", () => ({
  productWatchRepository: { isPublicationOrigin: mocks.origin },
}));
vi.mock("../../src/application/product-watch-service.js", () => ({
  productWatchService: {
    hasStartedShopper: mocks.started,
    removeProductWatch: mocks.remove,
    listProductWatches: mocks.list,
  },
}));
vi.mock("../../src/application/product-comparison-service.js", () => ({
  productComparisonService: {},
}));
vi.mock("../../src/adapters/persistence/shopper-session-repository.js", () => ({
  shopperSessions: { get: mocks.sessionGet, set: mocks.sessionSet },
}));
import {
  handleShopperCallback,
  handleShopperMessage,
} from "../../src/application/handle-shopper-interaction.js";
const id = "12345678-1234-4123-8123-123456789abc";
const logger = { warn: vi.fn() } as never;
const callback = (data: string, chatId = 123) => ({
  id: "real-callback",
  from: { id: 123 },
  data,
  message: { message_id: 42, chat: { id: chatId } },
});
beforeEach(() => {
  vi.clearAllMocks();
  mocks.started.mockResolvedValue(true);
  mocks.list.mockResolvedValue([]);
  mocks.origin.mockResolvedValue(true);
});
describe("shopper callback isolation", () => {
  it("does not intercept administrative commands during a shopper session", async () => {
    mocks.sessionGet.mockResolvedValue({ action: "watch" });
    expect(
      await handleShopperMessage(
        {
          from: { id: 123 },
          chat: { id: 123 },
          text: "/amazon https://amazon.com.br/dp/B000000001",
        },
        logger,
      ),
    ).toBe(false);
    expect(mocks.sessionGet).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("lets an explicit comparison command replace a watch input session", async () => {
    mocks.sessionGet.mockResolvedValue({ action: "watch" });
    await handleShopperMessage(
      { from: { id: 123 }, chat: { id: 123 }, text: "/comparar" },
      logger,
    );
    expect(mocks.sessionSet).toHaveBeenCalledWith(123, {
      action: "compare",
      left: undefined,
    });
    expect(mocks.send).toHaveBeenCalledWith(
      expect.objectContaining({
        markdown: expect.stringContaining("Comparar produtos"),
      }),
      expect.anything(),
    );
  });
  it("lets an explicit watch command replace a comparison session", async () => {
    mocks.sessionGet.mockResolvedValue({ action: "compare", left: "RX 550" });
    await handleShopperMessage(
      { from: { id: 123 }, chat: { id: 123 }, text: "/acompanhar" },
      logger,
    );
    expect(mocks.sessionSet).toHaveBeenCalledWith(123, { action: "watch" });
    expect(mocks.send).toHaveBeenCalledWith(
      expect.objectContaining({
        markdown: expect.stringContaining("Novo alerta"),
      }),
      expect.anything(),
    );
  });
  it("does not consume administrative approval callbacks", async () => {
    expect(
      await handleShopperCallback(callback("offer:approve:123"), logger),
    ).toBe(false);
    expect(mocks.answer).not.toHaveBeenCalled();
  });
  it("passes the authenticated actor into removal and never creates a public message", async () => {
    mocks.remove.mockResolvedValue(true);
    await handleShopperCallback(callback(`shop:remove:${id}`), logger);
    expect(mocks.remove).toHaveBeenCalledWith(123, id);
    expect(mocks.edit).toHaveBeenCalledWith(
      "123",
      42,
      expect.stringContaining("Alerta removido"),
    );
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("refuses to remove watches from a group callback", async () => {
    await handleShopperCallback(callback(`shop:remove:${id}`, -100), logger);
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(mocks.ephemeral).not.toHaveBeenCalled();
    expect(mocks.edit).not.toHaveBeenCalled();
  });
  it("uses recipient-scoped ephemeral content only on the actual published message", async () => {
    await handleShopperCallback(callback(`shop:watch:${id}`, -100), logger);
    expect(mocks.origin).toHaveBeenCalledWith(id, -100, 42);
    expect(mocks.ephemeral).toHaveBeenCalledWith(
      expect.objectContaining({
        receiverUserId: 123,
        callbackQueryId: "real-callback",
        chatId: "-100",
        markdown: expect.stringContaining(`start=watch_${id}`),
      }),
    );
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("does not expose a guessed offer on another message", async () => {
    mocks.origin.mockResolvedValue(false);
    await handleShopperCallback(callback(`shop:watch:${id}`, -100), logger);
    expect(mocks.ephemeral).not.toHaveBeenCalled();
    expect(mocks.answer).toHaveBeenCalled();
  });
});
