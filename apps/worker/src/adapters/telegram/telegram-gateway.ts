import { env } from "../../config/env.js";
import type { Logger } from "../../config/logger.js";
import { CHANNELS_LIST_LINK } from "../../domain/channels-footer.js";

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

  async sendRichMessage(
    input: TelegramRichMessageInput,
  ): Promise<{ messageId: number }> {
    const markdown = input.footer
      ? `${input.markdown}\n\n<tg-footer>${input.footer}</tg-footer>`
      : input.markdown;
    const richMessage: Record<string, unknown> = { markdown };
    const body: Record<string, unknown> = {
      chat_id: input.chatId,
      rich_message: richMessage,
    };
    if (input.replyMarkup) body.reply_markup = input.replyMarkup;

    const resp = await fetch(`${this.baseUrl}/sendRichMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await resp.json()) as {
      ok: boolean;
      result?: { message_id: number };
      description?: string;
    };
    if (!data.ok || !data.result) {
      throw new Error(`Telegram sendRichMessage failed: ${data.description}`);
    }
    return { messageId: data.result.message_id };
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

    const resp = await fetch(`${this.baseUrl}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await resp.json()) as {
      ok: boolean;
      result?: { message_id: number };
      description?: string;
    };
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
    const resp = await fetch(`${this.baseUrl}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await resp.json()) as {
      ok: boolean;
      result?: { message_id: number };
      description?: string;
    };
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

  buildPublicationKeyboard(affiliateUrl: string) {
    const buttons: Array<Record<string, string>> = [
      { text: "📣 Canais de promoção", url: CHANNELS_LIST_LINK },
    ];
    if (affiliateUrl.length <= 256) {
      buttons.unshift({ text: "🛒 Comprar com desconto", url: affiliateUrl });
    }
    return { inline_keyboard: [buttons] };
  }
}
