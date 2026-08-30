import { beforeEach, describe, expect, it, vi } from "vitest";

const getOffer = vi.fn();
const getProductById = vi.fn();
const eventExists = vi.fn();
const recordEvent = vi.fn();
const sendPhoto = vi.fn();

vi.mock("../../src/config/runtime.js", () => ({
  telegramEnv: {
    TELEGRAM_APPROVAL_CHAT_ID: "-1001",
    TELEGRAM_RICH_TEXT_ENABLED: false,
  },
}));
vi.mock("../../src/adapters/persistence/offer-repository.js", () => ({
  offerRepository: { getOffer },
}));
vi.mock("../../src/adapters/persistence/product-repository.js", () => ({
  productRepository: { getById: getProductById },
}));
vi.mock("../../src/adapters/persistence/repositories.js", () => ({
  workflowEventRepository: { exists: eventExists, record: recordEvent },
}));
vi.mock("../../src/adapters/telegram/telegram-gateway.js", () => ({
  TelegramGateway: class {
    sendPhoto = sendPhoto;
    buildChannelApprovalKeyboard = () => ({ inline_keyboard: [] });
  },
}));

const { requestChannelApproval } =
  await import("../../src/application/request-channel-approval.js");

describe("channel approval request", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOffer.mockResolvedValue({
      id: "offer-1",
      productId: "product-1",
      status: "pending_approval",
      imageUrl: "https://example.com/image.jpg",
      proposedCaption: "Oferta",
    });
    getProductById.mockResolvedValue({ title: "SSD NVMe", category: null });
    eventExists.mockResolvedValue(false);
    sendPhoto.mockResolvedValue({ messageId: 42 });
  });

  it("sends confidence evidence and records an idempotency event", async () => {
    const result = await requestChannelApproval(
      "offer-1",
      {
        niche: "hardware",
        confidence: "medium",
        evidence: "title",
        automatic: false,
      },
      { info: vi.fn() } as never,
    );

    expect(sendPhoto).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: "-1001",
        caption: expect.stringContaining("Confiança: média"),
      }),
    );
    expect(recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        entityId: "offer-1",
        eventType: "offer.channel_approval_requested",
        payload: expect.objectContaining({ messageId: 42 }),
      }),
    );
    expect(result).toEqual({ messageId: 42, status: "pending_approval" });
  });

  it("does not send a duplicate channel approval", async () => {
    eventExists.mockResolvedValue(true);

    const result = await requestChannelApproval(
      "offer-1",
      {
        niche: "general",
        confidence: "low",
        evidence: "conflict",
        automatic: false,
      },
      { info: vi.fn() } as never,
    );

    expect(sendPhoto).not.toHaveBeenCalled();
    expect(result).toEqual({ messageId: 0, status: "already_pending" });
  });
});
