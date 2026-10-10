import { z } from "zod";
const actor = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const chat = z.object({
  id: z.number().int().safe(),
  type: z.string().optional(),
});
export const shopperMessageSchema = z.object({
  from: z.object({ id: actor }),
  chat,
  message_id: z.number().int().optional(),
  text: z.string().max(4096),
});
export const shopperCallbackSchema = z.object({
  id: z.string().min(1).max(256),
  from: z.object({ id: actor }),
  data: z.string().min(1).max(64),
  message: z.object({ message_id: z.number().int(), chat }),
});
export function privateShopperActor(value: {
  from: { id: number };
  chat: { id: number; type?: string };
}): number | null {
  return Number.isSafeInteger(value.from.id) &&
    value.from.id > 0 &&
    value.chat.id === value.from.id &&
    (!value.chat.type || value.chat.type === "private")
    ? value.from.id
    : null;
}
export function shopperDeepLink(
  username: string,
  action: "watch" | "compare",
  offerId: string,
): string | null {
  if (
    !/^[a-z0-9_]{5,32}$/i.test(username) ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      offerId,
    )
  )
    return null;
  return `https://t.me/${username}?start=${action}_${offerId}`;
}
