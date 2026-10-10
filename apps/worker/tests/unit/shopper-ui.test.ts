import { describe, expect, it } from "vitest";
import {
  shopperMessageSchema,
  shopperCallbackSchema,
  shopperDeepLink,
  privateShopperActor,
} from "../../src/domain/shopper-ui.js";

describe("shopper interaction boundaries", () => {
  it("does not let group or another user's chat become an alert recipient", () => {
    expect(
      privateShopperActor({
        from: { id: 123 },
        chat: { id: 123, type: "private" },
      }),
    ).toBe(123);
    expect(
      privateShopperActor({
        from: { id: 123 },
        chat: { id: -123, type: "supergroup" },
      }),
    ).toBeNull();
    expect(
      privateShopperActor({
        from: { id: 123 },
        chat: { id: 456, type: "private" },
      }),
    ).toBeNull();
  });
  it("bounds untrusted text and callback data", () => {
    expect(
      shopperMessageSchema.safeParse({
        from: { id: 123 },
        chat: { id: 123 },
        text: "x".repeat(5000),
      }).success,
    ).toBe(false);
    expect(
      shopperCallbackSchema.safeParse({
        id: "callback",
        from: { id: 123 },
        data: "shop:" + "x".repeat(100),
        message: { message_id: 1, chat: { id: 123 } },
      }).success,
    ).toBe(false);
  });
  it("creates bounded start links without accepting arbitrary usernames or IDs", () => {
    const id = "12345678-1234-4123-8123-123456789abc";
    expect(shopperDeepLink("freguesiapromobot", "watch", id)).toBe(
      `https://t.me/freguesiapromobot?start=watch_${id}`,
    );
    expect(shopperDeepLink("bad/user", "watch", id)).toBeNull();
    expect(shopperDeepLink("bot", "watch", "other?url=evil")).toBeNull();
  });
});
