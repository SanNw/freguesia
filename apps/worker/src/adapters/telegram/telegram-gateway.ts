import { telegramEnv as env } from "../../config/runtime.js";
import type { Logger } from "../../config/logger.js";
import { CHANNELS_LIST_LINK } from "../../domain/channels-footer.js";
import { shopperDeepLink } from "../../domain/shopper-ui.js";
import {
  buildRichButtonRows,
  type RichButton,
} from "./telegram-rich-buttons.js";

const MAX_RETRY_ATTEMPTS = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    if (ms <= 0) {
      resolve();
      return;
    }
    setTimeout(resolve, ms);
  });
}

export interface TelegramResponse {
  ok: boolean;
  description?: string;
  error_code?: number;
  parameters?: { retry_after?: number };
  result?: { message_id: number };
}

export class TelegramMessageRejectedError extends Error {
  override name = "TelegramMessageRejectedError";
  constructor(
    message: string,
    readonly errorCode?: number,
  ) {
    super(message);
  }
}

export function adminUserIds(): number[] {
  return env.TELEGRAM_ADMIN_USER_IDS.split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n));
}

export function isAdmin(userId: number): boolean {
  return adminUserIds().includes(userId);
}

export interface TelegramSendPhotoInput {
  chatId: string;
  photo: string;
  caption: string;
  replyMarkup?: Record<string, unknown>;
}

export interface TelegramEditMessageInput {
  chatId: string;
  messageId: number;
  text: string;
  replyMarkup?: Record<string, unknown>;
}

export interface TelegramRichMessageInput {
  chatId: string;
  markdown: string;
  footer?: string;
  replyMarkup?: Record<string, unknown>;
}

export class TelegramGateway {
  constructor(private readonly logger: Logger) {}

  private get baseUrl() {
    return `${env.TELEGRAM_BOT_API_BASE.replace(/\/$/, "")}/bot${env.TELEGRAM_BOT_TOKEN}`;
  }

  private async request(
    method: string,
    body: Record<string, unknown>,
    retryAmbiguousErrors = true,
  ): Promise<TelegramResponse> {
    const url = `${this.baseUrl}/${method}`;
    let attempt = 0;

    while (true) {
      let resp: Response;
      try {
        resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } catch (networkError) {
        if (!retryAmbiguousErrors) throw networkError;
        attempt += 1;
        if (attempt > MAX_RETRY_ATTEMPTS) throw networkError;
        const delayMs = Math.min(1000 * 2 ** (attempt - 1), 10_000);
        this.logger.warn(
          { err: networkError, method, attempt },
          "Telegram request failed, retrying",
        );
        await sleep(delayMs);
        continue;
      }

      const data = (await resp.json()) as TelegramResponse;

      if (resp.status === 429) {
        const retryAfter = Number(data.parameters?.retry_after ?? 0);
        attempt += 1;
        if (attempt > MAX_RETRY_ATTEMPTS) {
          this.logger.error(
            { method, retryAfter },
            "Telegram rate limited, exhausted retries",
          );
          return data;
        }
        const delayMs = Math.max(retryAfter * 1000, 1_000);
        this.logger.warn(
          { method, retryAfter, attempt },
          "Telegram 429, waiting before retry",
        );
        await sleep(delayMs);
        continue;
      }

      if (
        retryAmbiguousErrors &&
        resp.status >= 500 &&
        attempt < MAX_RETRY_ATTEMPTS
      ) {
        attempt += 1;
        const delayMs = Math.min(1000 * 2 ** (attempt - 1), 10_000);
        this.logger.warn(
          { method, status: resp.status, attempt },
          "Telegram returned server error, retrying",
        );
        await sleep(delayMs);
        continue;
      }

      return data;
    }
  }

  async sendRichMessage(
    input: TelegramRichMessageInput,
    options: { retryAmbiguousErrors?: boolean } = {},
  ): Promise<{ messageId: number }> {
    const markdown = input.footer
      ? `${input.markdown}\n\n<footer>${input.footer}</footer>`
      : input.markdown;
    const richMessage: Record<string, unknown> = { markdown };
    const body: Record<string, unknown> = {
      chat_id: input.chatId,
      rich_message: richMessage,
    };
    if (input.replyMarkup) body.reply_markup = input.replyMarkup;

    const data = await this.request(
      "sendRichMessage",
      body,
      options.retryAmbiguousErrors,
    );
    if (!data.ok || !data.result) {
      if (data.error_code && data.error_code >= 400 && data.error_code < 500) {
        throw new TelegramMessageRejectedError(
          `Telegram sendRichMessage failed: ${data.description}`,
          data.error_code,
        );
      }
      throw new Error(`Telegram sendRichMessage failed: ${data.description}`);
    }
    return { messageId: data.result.message_id };
  }

  async editRichMessage(
    chatId: string,
    messageId: number,
    markdown: string,
  ): Promise<void> {
    const data = await this.request(
      "editMessageText",
      { chat_id: chatId, message_id: messageId, rich_message: { markdown } },
      false,
    );
    if (!data.ok && !data.description?.includes("message is not modified"))
      throw new TelegramMessageRejectedError(
        `Telegram editMessageText failed: ${data.description}`,
        data.error_code,
      );
  }
  async sendEphemeralRichMessage(input: {
    chatId: string;
    receiverUserId: number;
    callbackQueryId: string;
    markdown: string;
  }): Promise<void> {
    const data = await this.request(
      "sendRichMessage",
      {
        chat_id: input.chatId,
        rich_message: { markdown: input.markdown },
        ephemeral_message_parameters: {
          receiver_user_id: input.receiverUserId,
          callback_query_id: input.callbackQueryId,
          replace_callback_query_message: true,
        },
      },
      false,
    );
    if (!data.ok)
      throw new TelegramMessageRejectedError(
        `Telegram ephemeral send failed: ${data.description}`,
        data.error_code,
      );
  }

  buildOfferRichMarkdown(mediaUrls: string[], caption: string): string {
    const mediaItems = [...new Set(mediaUrls)]
      .filter((url) => /^https?:\/\//i.test(url))
      .slice(0, 10);
    const mediaMarkdown = mediaItems.map((url) => `![](${url})`).join("\n");
    const media =
      mediaItems.length > 1
        ? `<tg-slideshow>\n${mediaMarkdown}\n</tg-slideshow>`
        : mediaMarkdown;
    return `${media}\n\n${caption}`.trim();
  }

  async sendPhoto(
    input: TelegramSendPhotoInput,
  ): Promise<{ messageId: number }> {
    const body: Record<string, unknown> = {
      chat_id: input.chatId,
      photo: input.photo,
      caption: input.caption,
      parse_mode: env.TELEGRAM_PARSE_MODE,
      disable_notification: env.TELEGRAM_DISABLE_NOTIFICATION,
      protect_content: env.TELEGRAM_PROTECT_CONTENT,
    };
    if (input.replyMarkup) {
      body.reply_markup = JSON.stringify(input.replyMarkup);
    }

    const data = await this.request("sendPhoto", body);
    if (!data.ok) {
      this.logger.error(
        { description: data.description },
        "Telegram sendPhoto failed",
      );
      throw new Error(`Telegram sendPhoto failed: ${data.description}`);
    }
    return { messageId: data.result!.message_id };
  }

  async sendMessage(
    chatId: string,
    text: string,
    replyMarkup?: Record<string, unknown>,
  ): Promise<{ messageId: number }> {
    const body: Record<string, unknown> = {
      chat_id: chatId,
      text,
      parse_mode: env.TELEGRAM_PARSE_MODE,
      disable_web_page_preview: false,
    };
    if (replyMarkup) {
      body.reply_markup = JSON.stringify(replyMarkup);
    }
    const data = await this.request("sendMessage", body);
    if (!data.ok) {
      throw new Error(`Telegram sendMessage failed: ${data.description}`);
    }
    return { messageId: data.result!.message_id };
  }

  async editMessageText(input: TelegramEditMessageInput): Promise<void> {
    const body: Record<string, unknown> = {
      chat_id: input.chatId,
      message_id: input.messageId,
      text: input.text,
      parse_mode: env.TELEGRAM_PARSE_MODE,
    };
    if (input.replyMarkup) {
      body.reply_markup = JSON.stringify(input.replyMarkup);
    }

    const resp = await fetch(`${this.baseUrl}/editMessageText`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await resp.json()) as { ok: boolean; description?: string };
    if (!data.ok) {
      this.logger.warn(
        { description: data.description },
        "Telegram editMessageText failed",
      );
    }
  }

  async answerCallbackQuery(
    callbackQueryId: string,
    text?: string,
  ): Promise<void> {
    await fetch(`${this.baseUrl}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: text,
        show_alert: false,
      }),
    });
  }

  async deleteMessage(
    chatId: number | string,
    messageId: number,
  ): Promise<void> {
    const resp = await fetch(`${this.baseUrl}/deleteMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId }),
    });
    const data = (await resp.json()) as { ok: boolean; description?: string };
    if (!data.ok) {
      throw new Error(`Telegram deleteMessage failed: ${data.description}`);
    }
  }

  buildApprovalKeyboard(offerShortId: string, affiliateUrl?: string | null) {
    const rows: Array<Array<Record<string, string>>> = [];
    if (affiliateUrl && affiliateUrl.length <= 256) {
      rows.push([
        { text: "🛒 Comprar com desconto", url: affiliateUrl },
        { text: "📣 Canais de promoção", url: CHANNELS_LIST_LINK },
      ]);
    }
    return {
      inline_keyboard: [
        ...rows,
        [
          {
            text: "\u2705 Aprovar",
            callback_data: `offer:approve:${offerShortId}`,
          },
          {
            text: "\u270f\ufe0f Editar",
            callback_data: `offer:edit:${offerShortId}`,
          },
        ],
        [
          {
            text: "\u274c Descartar",
            callback_data: `offer:reject:${offerShortId}`,
          },
          {
            text: "\ud83d\udd04 Revalidar",
            callback_data: `offer:revalidate:${offerShortId}`,
          },
        ],
        [
          {
            text: "\ud83d\udd52 Agendar",
            callback_data: `offer:schedule:${offerShortId}`,
          },
        ],
      ],
    };
  }

  buildApprovalRichButtons(
    offerShortId: string,
    affiliateUrl?: string | null,
  ): string {
    const rows: RichButton[][] = [];
    if (affiliateUrl && affiliateUrl.length <= 256) {
      rows.push([
        {
          text: "🛒 Comprar com desconto",
          url: affiliateUrl,
          style: "success",
        },
        {
          text: "📣 Canais de promoção",
          url: CHANNELS_LIST_LINK,
          style: "primary",
        },
      ]);
    }
    rows.push(
      [
        {
          text: "✅ Aprovar",
          callbackData: `offer:approve:${offerShortId}`,
          style: "success",
        },
        {
          text: "✏️ Editar",
          callbackData: `offer:edit:${offerShortId}`,
          style: "primary",
        },
      ],
      [
        {
          text: "❌ Descartar",
          callbackData: `offer:reject:${offerShortId}`,
          style: "danger",
        },
        {
          text: "🔄 Revalidar",
          callbackData: `offer:revalidate:${offerShortId}`,
        },
        { text: "🕒 Agendar", callbackData: `offer:schedule:${offerShortId}` },
      ],
    );
    return buildRichButtonRows(rows);
  }

  buildChannelApprovalKeyboard(offerId: string) {
    const button = (text: string, niche: string) => ({
      text,
      callback_data: `offer:channel:${niche}:${offerId}`,
    });
    return {
      inline_keyboard: [
        [button("Hardware", "hardware"), button("Eletrônicos", "electronics")],
        [
          button("Eletrodomésticos", "appliances"),
          button("Casa e Cozinha", "home_kitchen"),
        ],
        [button("Beleza", "beauty"), button("Moda", "fashion")],
        [button("Ofertas Gerais", "general")],
        [button("Descartar", "discard")],
      ],
    };
  }

  buildChannelApprovalRichButtons(offerId: string): string {
    const button = (
      text: string,
      niche: string,
      style?: RichButton["style"],
    ) => ({
      text,
      callbackData: `offer:channel:${niche}:${offerId}`,
      style,
    });
    return buildRichButtonRows([
      [button("Hardware", "hardware"), button("Eletrônicos", "electronics")],
      [
        button("Eletrodomésticos", "appliances"),
        button("Casa e Cozinha", "home_kitchen"),
      ],
      [button("Beleza", "beauty"), button("Moda", "fashion")],
      [button("Ofertas Gerais", "general", "primary")],
      [button("Descartar", "discard", "danger")],
    ]);
  }

  buildPublicationKeyboard(affiliateUrl: string, offerId?: string) {
    const buttons: Array<Record<string, string>> = [
      { text: "📣 Canais de promoção", url: CHANNELS_LIST_LINK },
    ];
    if (affiliateUrl.length <= 256) {
      buttons.unshift({ text: "🛒 Comprar com desconto", url: affiliateUrl });
    }
    const watch =
      env.SHOPPING_ASSISTANT_ENABLED && offerId
        ? shopperDeepLink(env.TELEGRAM_BOT_USERNAME, "watch", offerId)
        : null;
    const compare =
      env.SHOPPING_ASSISTANT_ENABLED && offerId
        ? shopperDeepLink(env.TELEGRAM_BOT_USERNAME, "compare", offerId)
        : null;
    return {
      inline_keyboard: [
        buttons,
        ...(watch && compare
          ? [
              [
                {
                  text: "🔔 Acompanhar produto",
                  callback_data: `shop:watch:${offerId}`,
                },
                {
                  text: "⚖️ Comparar",
                  callback_data: `shop:compare:${offerId}`,
                },
              ],
            ]
          : []),
      ],
    };
  }

  buildPublicationRichButtons(affiliateUrl: string, offerId?: string): string {
    const buttons: RichButton[] = [
      {
        text: "📣 Canais de promoção",
        url: CHANNELS_LIST_LINK,
        style: "primary",
      },
    ];
    if (affiliateUrl.length <= 256) {
      buttons.unshift({
        text: "🛒 Comprar com desconto",
        url: affiliateUrl,
        style: "success",
      });
    }
    const watch =
      env.SHOPPING_ASSISTANT_ENABLED && offerId
        ? shopperDeepLink(env.TELEGRAM_BOT_USERNAME, "watch", offerId)
        : null;
    const compare =
      env.SHOPPING_ASSISTANT_ENABLED && offerId
        ? shopperDeepLink(env.TELEGRAM_BOT_USERNAME, "compare", offerId)
        : null;
    return buildRichButtonRows([
      buttons,
      ...(watch && compare
        ? [
            [
              {
                text: "🔔 Acompanhar produto",
                callbackData: `shop:watch:${offerId}`,
              },
              { text: "⚖️ Comparar", callbackData: `shop:compare:${offerId}` },
            ],
          ]
        : []),
    ]);
  }
}
