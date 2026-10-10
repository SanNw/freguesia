import { db } from "./db.js";
import { assertShopperChatId } from "../../domain/product-watch.js";
export interface ShopperSession {
  action: "watch" | "compare";
  left?: string;
}
export const shopperSessions = {
  async set(chatId: number, session: ShopperSession): Promise<void> {
    assertShopperChatId(chatId);
    await db.query(
      `INSERT INTO shopper_sessions(chat_id, action, data, expires_at)
      VALUES ($1, $2, $3, NOW() + INTERVAL '15 minutes')
      ON CONFLICT (chat_id) DO UPDATE SET action = EXCLUDED.action, data = EXCLUDED.data,
        expires_at = EXCLUDED.expires_at, updated_at = NOW()`,
      [chatId, session.action, JSON.stringify({ left: session.left })],
    );
  },
  async get(chatId: number): Promise<ShopperSession | null> {
    assertShopperChatId(chatId);
    const rows = await db.query(
      `SELECT action, data FROM shopper_sessions WHERE chat_id = $1 AND expires_at > NOW()`,
      [chatId],
    );
    const row = rows[0];
    if (!row || !["watch", "compare"].includes(String(row.action))) return null;
    const data = row.data as { left?: string };
    return {
      action: row.action as ShopperSession["action"],
      left: typeof data.left === "string" ? data.left : undefined,
    };
  },
  async clear(chatId: number): Promise<void> {
    assertShopperChatId(chatId);
    await db.query(`DELETE FROM shopper_sessions WHERE chat_id = $1`, [chatId]);
  },
};
