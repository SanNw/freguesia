const CHANNELS_LIST_URL = "https://t.me/addlist/hrnEPhgLIMoxNjVh";

export const CHANNELS_FOOTER_TEXT =
  "Conheça os outros nossos canais de promoção";

export const CHANNELS_FOOTER = `Conheça os outros nossos <a href="${CHANNELS_LIST_URL}">canais de promoção</a>`;

export const CHANNELS_LIST_LINK = CHANNELS_LIST_URL;

export function appendChannelsFooter(caption: string): string {
  const cleaned = caption.trim();
  return cleaned.includes(CHANNELS_LIST_URL)
    ? cleaned
    : `${cleaned}\n\n${CHANNELS_FOOTER}`;
}
