import type { Logger } from "../config/logger.js";
import { telegramEnv as env } from "../config/runtime.js";
import { TelegramGateway } from "../adapters/telegram/telegram-gateway.js";
import { buildRichButtonRows } from "../adapters/telegram/telegram-rich-buttons.js";
import { shopperSessions } from "../adapters/persistence/shopper-session-repository.js";
import { CHANNELS_LIST_LINK } from "../domain/channels-footer.js";
import {
  shopperMessageSchema,
  shopperCallbackSchema,
  privateShopperActor,
  shopperDeepLink,
} from "../domain/shopper-ui.js";
import { productWatchRepository } from "../adapters/persistence/product-watch-repository.js";
import {
  escapeComparisonText as escape,
  parseComparisonCommand,
} from "../domain/product-comparison.js";
import {
  productWatchService as watches,
  type WatchConfirmation,
} from "./product-watch-service.js";
import { productComparisonService as comparison } from "./product-comparison-service.js";

const navigation = () =>
  buildRichButtonRows([
    [
      { text: "🔔 Meus alertas", callbackData: "shop:list" },
      { text: "➕ Novo alerta", callbackData: "shop:new" },
    ],
    [
      { text: "⚖️ Comparar produtos", callbackData: "shop:compare" },
      { text: "📣 Canais", url: CHANNELS_LIST_LINK },
    ],
  ]);
const back = () =>
  buildRichButtonRows([[{ text: "← Menu", callbackData: "shop:menu" }]]);
export const shopperMenu = () =>
  `## Seu assistente de compras\n\nAcompanhe um produto ou compare duas opções. Quando encontrarmos uma nova condição verificada, seu alerta chega aqui no privado.\n\n${navigation()}`;

function confirmation(watch: WatchConfirmation): string {
  const coverage =
    watch.monitoring === "direct"
      ? "Consultamos a Shopee para este item. Se houver várias opções com preços diferentes, aguardamos uma oferta da variante exata; não usamos o menor preço como se valesse para todas."
      : "Avisaremos quando uma oferta deste produto exato entrar no nosso catálogo. Este alerta não é uma consulta contínua a todos os anúncios da loja.";
  return `## ${watch.alreadyWatching ? "Você já acompanha este produto" : "Alerta criado"}\n\n${escape(watch.title)}\n\n${coverage}\n\nMáximo de 20 produtos por pessoa. Links de compra são de afiliado do Freguesia.\n\n${buildRichButtonRows([[{ text: "Remover alerta", callbackData: `shop:remove:${watch.id}`, style: "danger" }]])}\n${navigation()}`;
}
async function list(chatId: number): Promise<string> {
  const items = await watches.listProductWatches(chatId);
  return `## Meus alertas\n\n${items.length ? `${items.length} de 20 produtos acompanhados.\n\n` + items.map((item, index) => `${index + 1}. ${escape(item.title.slice(0, 150))}\n${buildRichButtonRows([[{ text: "Remover este alerta", callbackData: `shop:remove:${item.id}`, style: "danger" }]])}`).join("\n\n") : "Nenhum alerta por enquanto. Toque em Novo alerta e envie o link do produto."}\n\n${navigation()}`;
}
async function compare(
  chatId: number,
  left: string,
  right: string,
): Promise<string> {
  const result = await comparison.compareProducts(left, right);
  await shopperSessions.clear(chatId);
  const rows = result.choices.flatMap((choice) => [
    [
      {
        text: `Comprar ${choice.side === "left" ? "opção A" : "opção B"}`,
        url: choice.affiliateUrl,
        style: "success" as const,
      },
    ],
  ]);
  return `${result.markdown}\n\n${buildRichButtonRows(rows)}\n${navigation()}`;
}
async function beginComparison(
  chatId: number,
  offerId?: string,
): Promise<string> {
  const suggestions = offerId
    ? await comparison.comparisonSuggestions(offerId)
    : null;
  await shopperSessions.set(chatId, {
    action: "compare",
    left: suggestions?.left,
  });
  return `## Comparar produtos\n\n${suggestions ? `Produto A: ${escape(suggestions.title)}\nEnvie o nome do produto B.` : "Envie dois nomes separados por vs.\nExemplo: RX 550 vs GTX 1050 Ti"}\n\nEsta seleção expira em 15 minutos.\n\n${suggestions?.choices.length ? buildRichButtonRows(suggestions.choices.map((choice, index) => [{ text: choice.label, callbackData: `shop:pick:${index}` }])) + "\n" : ""}${back()}`;
}

export async function handleShopperMessage(
  raw: unknown,
  logger: Logger,
): Promise<boolean> {
  if (!env.SHOPPING_ASSISTANT_ENABLED) return false;
  const parsed = shopperMessageSchema.safeParse(raw);
  if (!parsed.success) return false;
  const message = parsed.data,
    chatId = privateShopperActor(message);
  if (!chatId) return false;
  const text = message.text.trim();
  const isStart = /^\/start(?:@[a-z0-9_]+)?(?:\s|$)/i.test(text);
  const command = text.replace(/^\/([a-z]+)@[a-z0-9_]+/i, "/$1");
  const recognized =
    isStart ||
    /^\/(alertas|acompanhar|comparar)(?:\s|$)/i.test(command) ||
    /^https:\/\//i.test(text);
  // Existing administrative commands must keep their own handler, even while
  // a shopper is filling in a short-lived product selection.
  if (text.startsWith("/") && !recognized) return false;
  if (!recognized && !(await watches.hasStartedShopper(chatId))) return false;
  const session = await shopperSessions.get(chatId);
  if (!recognized && !session) return false;
  const gateway = new TelegramGateway(logger);
  try {
    if (isStart) {
      await watches.startShopper(chatId);
      await shopperSessions.clear(chatId);
      const deep = text.match(/\s+(watch|compare)_([0-9a-f-]{36})$/i);
      const markdown =
        deep?.[1] === "watch"
          ? confirmation(await watches.subscribeOffer(chatId, deep[2]))
          : deep?.[1] === "compare"
            ? await beginComparison(chatId, deep[2])
            : shopperMenu();
      await gateway.sendRichMessage(
        { chatId: String(chatId), markdown },
        { retryAmbiguousErrors: false },
      );
      return true;
    }
    if (!(await watches.hasStartedShopper(chatId))) {
      await gateway.sendRichMessage(
        {
          chatId: String(chatId),
          markdown: "Envie /start para ativar seus alertas privados.",
        },
        { retryAmbiguousErrors: false },
      );
      return true;
    }
    let markdown: string;
    if (/^\/alertas$/i.test(command)) markdown = await list(chatId);
    else if (
      /^https:\/\//i.test(text) ||
      /^\/acompanhar\s+/i.test(command) ||
      (!recognized && session?.action === "watch")
    ) {
      const url = command.replace(/^\/acompanhar\s+/i, "");
      markdown = confirmation(await watches.subscribeUrl(chatId, url));
      await shopperSessions.clear(chatId);
    } else if (/^\/comparar$/i.test(command))
      markdown = await beginComparison(chatId);
    else if (
      /^\/comparar\s+/i.test(command) ||
      (!recognized && session?.action === "compare")
    ) {
      const pair = parseComparisonCommand(command);
      if (pair) markdown = await compare(chatId, pair.left, pair.right);
      else if (session?.left)
        markdown = await compare(chatId, session.left, text);
      else
        throw new Error(
          "Envie dois produtos separados por vs. Exemplo: RX 550 vs GTX 1050 Ti.",
        );
    } else if (/^\/acompanhar$/i.test(command)) {
      await shopperSessions.set(chatId, { action: "watch" });
      markdown = `## Novo alerta\n\nEnvie o link HTTPS de um produto da Shopee, Mercado Livre, Amazon, KaBuM ou AliExpress.\n\n${back()}`;
    } else return false;
    await gateway.sendRichMessage(
      { chatId: String(chatId), markdown },
      { retryAmbiguousErrors: false },
    );
  } catch (error) {
    const detail =
      error instanceof Error
        ? error.message
        : "Não foi possível concluir esta ação.";
    logger.warn({ err: error }, "Shopper message failed");
    await gateway.sendRichMessage(
      { chatId: String(chatId), markdown: `${escape(detail)}\n\n${back()}` },
      { retryAmbiguousErrors: false },
    );
  }
  return true;
}

export async function handleShopperCallback(
  raw: unknown,
  logger: Logger,
): Promise<boolean> {
  if (
    !env.SHOPPING_ASSISTANT_ENABLED ||
    !raw ||
    typeof raw !== "object" ||
    !("data" in raw) ||
    typeof raw.data !== "string" ||
    !raw.data.startsWith("shop:")
  )
    return false;
  const parsed = shopperCallbackSchema.safeParse(raw);
  if (!parsed.success) return true;
  const callback = parsed.data;
  const gateway = new TelegramGateway(logger);
  const chatId = privateShopperActor({
    from: callback.from,
    chat: callback.message.chat,
  });
  if (!chatId) {
    const [, action, id] = callback.data.split(":");
    const link =
      (action === "watch" || action === "compare") && id
        ? shopperDeepLink(env.TELEGRAM_BOT_USERNAME, action, id)
        : null;
    if (
      !link ||
      !(await productWatchRepository.isPublicationOrigin(
        id,
        callback.message.chat.id,
        callback.message.message_id,
      ))
    ) {
      await gateway.answerCallbackQuery(
        callback.id,
        "Esta ação só está disponível na publicação original ou no privado.",
      );
      return true;
    }
    try {
      await gateway.sendEphemeralRichMessage({
        chatId: String(callback.message.chat.id),
        receiverUserId: callback.from.id,
        callbackQueryId: callback.id,
        markdown: `## ${action === "watch" ? "Acompanhar este produto" : "Comparar este produto"}\n\nContinue no privado. Só você vê esta mensagem temporária; nada será publicado no canal.\n\n${buildRichButtonRows([[{ text: "Abrir no bot", url: link, style: "primary" }]])}`,
      });
      await gateway.answerCallbackQuery(callback.id, "");
    } catch (error) {
      logger.warn({ err: error }, "Ephemeral shopper reply unavailable");
      await gateway.answerCallbackQuery(
        callback.id,
        "Abra o bot no privado e envie o link do produto.",
      );
    }
    return true;
  }
  // Acknowledge promptly; these temporary toasts never create channel messages.
  await gateway.answerCallbackQuery(callback.id, "");
  try {
    if (!(await watches.hasStartedShopper(chatId)))
      throw new Error("Envie /start para ativar seus alertas.");
    const [, action, id] = callback.data.split(":");
    let markdown: string;
    if (action === "menu") {
      await shopperSessions.clear(chatId);
      markdown = shopperMenu();
    } else if (action === "list") markdown = await list(chatId);
    else if (action === "new") {
      await shopperSessions.set(chatId, { action: "watch" });
      markdown = `## Novo alerta\n\nEnvie o link HTTPS do produto desejado. A seleção expira em 15 minutos.\n\n${back()}`;
    } else if (action === "remove") {
      const removed = await watches.removeProductWatch(chatId, id ?? "");
      markdown = `${removed ? "Alerta removido." : "Alerta já removido ou não pertence a você."}\n\n${await list(chatId)}`;
    } else if (action === "watch")
      markdown = confirmation(await watches.subscribeOffer(chatId, id ?? ""));
    else if (action === "compare") markdown = await beginComparison(chatId, id);
    else if (action === "pick") {
      const session = await shopperSessions.get(chatId);
      if (session?.action !== "compare" || !session.left || id !== "0")
        throw new Error("Seleção expirada. Abra Comparar produtos novamente.");
      const profile = session.left;
      if (!["RX 550", "GTX 1050 Ti"].includes(profile))
        throw new Error("Seleção inválida.");
      markdown = await compare(
        chatId,
        profile,
        profile === "RX 550" ? "GTX 1050 Ti" : "RX 550",
      );
    } else throw new Error("Ação não disponível.");
    await gateway.editRichMessage(
      String(chatId),
      callback.message.message_id,
      markdown,
    );
  } catch (error) {
    logger.warn({ err: error }, "Shopper callback failed");
    await gateway.editRichMessage(
      String(chatId),
      callback.message.message_id,
      `${escape(error instanceof Error ? error.message : "Ação indisponível.")}\n\n${back()}`,
    );
  }
  return true;
}
