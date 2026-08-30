import { beforeEach, describe, expect, it, vi } from "vitest";

const transitionStatus = vi.fn();
const updateStatus = vi.fn();
const setPublicationNiche = vi.fn();
const getByIdShort = vi.fn();
const recordApproval = vi.fn();
const answerCallbackQuery = vi.fn();
const deleteMessage = vi.fn();
const sendMessage = vi.fn();
const publishOffer = vi.fn();

vi.mock("../../src/config/runtime.js", () => ({
  telegramEnv: { TELEGRAM_APPROVAL_CHAT_ID: "-1001" },
}));
vi.mock("../../src/adapters/persistence/offer-repository.js", () => ({
  offerRepository: {
    getByIdShort,
    setPublicationNiche,
    transitionStatus,
    updateStatus,
  },
}));
vi.mock("../../src/adapters/persistence/repositories.js", () => ({
  approvalRepository: { recordApproval },
}));
vi.mock("../../src/adapters/telegram/telegram-gateway.js", () => ({
  isAdmin: () => true,
  TelegramGateway: class {
    answerCallbackQuery = answerCallbackQuery;
    deleteMessage = deleteMessage;
    sendMessage = sendMessage;
  },
}));
vi.mock("../../src/application/publish-offer.js", () => ({ publishOffer }));

const { handleTelegramCallback } =
  await import("../../src/application/handle-telegram-callback.js");

describe("Telegram approval callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getByIdShort.mockResolvedValue({
      id: "offer-id",
      status: "pending_approval",
    });
    transitionStatus.mockResolvedValue(true);
    setPublicationNiche.mockResolvedValue(true);
    recordApproval.mockResolvedValue(undefined);
    answerCallbackQuery.mockResolvedValue(undefined);
    deleteMessage.mockResolvedValue(undefined);
    publishOffer.mockResolvedValue({ status: "published", messageId: 1 });
  });

  it("acknowledges approval and queues publication without waiting for Telegram delivery", async () => {
    const result = await handleTelegramCallback(
      {
        id: "callback-id",
        from: { id: 123, username: "admin" },
        data: "offer:approve:offer-id",
        message: { message_id: 42, chat: { id: -1001 } },
      },
      { info: vi.fn(), warn: vi.fn() } as never,
    );

    expect(transitionStatus).toHaveBeenCalledWith(
      "offer-id",
      ["pending_approval"],
      "scheduled",
    );
    expect(answerCallbackQuery).toHaveBeenCalledWith(
      "callback-id",
      "Oferta aprovada e adicionada à fila",
    );
    expect(deleteMessage).toHaveBeenCalledWith(-1001, 42);
    expect(publishOffer).not.toHaveBeenCalled();
    expect(result).toEqual({ status: "scheduled" });
  });

  it.each([
    "hardware",
    "electronics",
    "appliances",
    "home_kitchen",
    "beauty",
    "fashion",
    "general",
  ])("persists manual channel %s and schedules the offer", async (niche) => {
    const offerId = "0f48947c-5f5c-4a5b-9745-5b35df4dff17";
    getByIdShort.mockResolvedValue({ id: offerId, status: "pending_approval" });

    const result = await handleTelegramCallback(
      {
        id: `callback-${niche}`,
        from: { id: 123, username: "admin" },
        data: `offer:channel:${niche}:${offerId}`,
        message: { message_id: 42, chat: { id: -1001 } },
      },
      { info: vi.fn(), warn: vi.fn() } as never,
    );

    expect(setPublicationNiche).toHaveBeenCalledWith(offerId, niche, "manual", [
      "pending_approval",
    ]);
    expect(deleteMessage).toHaveBeenCalledWith(-1001, 42);
    expect(result).toEqual({ status: "scheduled" });
  });

  it("discards an uncertain offer idempotently", async () => {
    const offerId = "0f48947c-5f5c-4a5b-9745-5b35df4dff17";
    getByIdShort.mockResolvedValue({ id: offerId, status: "pending_approval" });

    const result = await handleTelegramCallback(
      {
        id: "callback-discard",
        from: { id: 123, username: "admin" },
        data: `offer:channel:discard:${offerId}`,
        message: { message_id: 42, chat: { id: -1001 } },
      },
      { info: vi.fn(), warn: vi.fn() } as never,
    );

    expect(transitionStatus).toHaveBeenCalledWith(
      offerId,
      ["pending_approval"],
      "rejected",
      "Discarded by admin",
    );
    expect(result).toEqual({ status: "rejected" });
  });

  it("does not change a channel choice that was already processed", async () => {
    const offerId = "0f48947c-5f5c-4a5b-9745-5b35df4dff17";
    getByIdShort.mockResolvedValue({ id: offerId, status: "pending_approval" });
    setPublicationNiche.mockResolvedValue(false);

    const result = await handleTelegramCallback(
      {
        id: "callback-repeat",
        from: { id: 123, username: "admin" },
        data: `offer:channel:fashion:${offerId}`,
        message: { message_id: 42, chat: { id: -1001 } },
      },
      { info: vi.fn(), warn: vi.fn() } as never,
    );

    expect(deleteMessage).not.toHaveBeenCalled();
    expect(result).toEqual({ status: "already_processed" });
  });
});
