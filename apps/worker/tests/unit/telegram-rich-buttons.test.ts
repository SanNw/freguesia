import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/config/runtime.js", () => ({
  telegramEnv: {
    TELEGRAM_BOT_TOKEN: "test-token",
    TELEGRAM_BOT_API_BASE: "https://api.telegram.org",
  },
}));
import { TelegramGateway } from "../../src/adapters/telegram/telegram-gateway.js";
import { buildRichButtonRows } from "../../src/adapters/telegram/telegram-rich-buttons.js";

describe("buildRichButtonRows", () => {
  it("renders Telegram rich-message buttons instead of an inline keyboard", () => {
    expect(
      buildRichButtonRows([
        [
          {
            text: "Comprar",
            url: "https://example.com/oferta?a=1&b=2",
            style: "success",
          },
          {
            text: "Aprovar",
            callbackData: "offer:approve:123",
            style: "primary",
          },
        ],
      ]),
    ).toBe(
      '<tg-button-row><tg-button type="url" style="success" url="https://example.com/oferta?a=1&amp;b=2">Comprar</tg-button><tg-button type="callback_data" style="primary" data="offer:approve:123">Aprovar</tg-button></tg-button-row>',
    );
  });

  it("colors the publication actions by purpose", () => {
    const gateway = new TelegramGateway({} as never);

    expect(
      gateway.buildPublicationRichButtons("https://example.com/oferta"),
    ).toBe(
      '<tg-button-row><tg-button type="url" style="success" url="https://example.com/oferta">🛒 Comprar com desconto</tg-button><tg-button type="url" style="primary" url="https://t.me/addlist/hrnEPhgLIMoxNjVh">📣 Canais de promoção</tg-button></tg-button-row>',
    );
  });

  it("builds all channel choices within Telegram callback limits", () => {
    const gateway = new TelegramGateway({} as never);
    const offerId = "0f48947c-5f5c-4a5b-9745-5b35df4dff17";
    const keyboard = gateway.buildChannelApprovalKeyboard(offerId);
    const callbacks = keyboard.inline_keyboard
      .flat()
      .map((button) => button.callback_data);

    expect(callbacks).toEqual([
      `offer:channel:hardware:${offerId}`,
      `offer:channel:electronics:${offerId}`,
      `offer:channel:appliances:${offerId}`,
      `offer:channel:home_kitchen:${offerId}`,
      `offer:channel:beauty:${offerId}`,
      `offer:channel:fashion:${offerId}`,
      `offer:channel:general:${offerId}`,
      `offer:channel:discard:${offerId}`,
    ]);
    expect(callbacks.every((value) => Buffer.byteLength(value) <= 64)).toBe(
      true,
    );
  });
});
