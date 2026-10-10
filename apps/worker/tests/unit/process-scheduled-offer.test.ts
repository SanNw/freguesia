import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../src/shared/errors.js";

const findNextScheduled = vi.fn();
const expireScheduledOffers = vi.fn();
const updateStatus = vi.fn();
const transitionStatus = vi.fn();
const setPublicationNiche = vi.fn();
const wasRecentlyPublished = vi.fn();
const findManualNicheForProduct = vi.fn();
const getProductById = vi.fn();
const classifyProductNicheDecision = vi.fn();
const publishOffer = vi.fn();
const requestChannelApproval = vi.fn();

vi.mock("../../src/config/runtime.js", () => ({
  publicationEnv: {
    REPOST_COOLDOWN_HOURS: 168,
    REPOST_MIN_PRICE_DROP_PERCENT: 10,
  },
}));

vi.mock("../../src/adapters/persistence/offer-repository.js", () => ({
  offerRepository: {
    expireScheduledOffers,
    findNextScheduled,
    setPublicationNiche,
    wasRecentlyPublished,
    findManualNicheForProduct,
    transitionStatus,
    updateStatus,
  },
}));
vi.mock("../../src/adapters/persistence/product-repository.js", () => ({
  productRepository: { getById: getProductById },
}));
vi.mock("../../src/domain/product-niche.js", () => ({
  classifyProductNicheDecision,
  PRODUCT_CLASSIFIER_VERSION: "2.0.0",
}));
vi.mock("../../src/application/publish-offer.js", () => ({ publishOffer }));
vi.mock("../../src/application/request-channel-approval.js", () => ({
  requestChannelApproval,
}));

const { processNextScheduledOffer } =
  await import("../../src/application/process-scheduled-offer.js");

describe("scheduled offer processing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    expireScheduledOffers.mockResolvedValue(0);
    findNextScheduled.mockResolvedValue({
      id: "offer-1",
      productId: "product-1",
      status: "scheduled",
      publicationNiche: null,
      publicationNicheSource: null,
    });
    getProductById.mockResolvedValue({
      id: "product-1",
      title: "Smartphone Galaxy A17",
      category: "Celulares e Telefones > Smartphones",
    });
    setPublicationNiche.mockResolvedValue(true);
    wasRecentlyPublished.mockResolvedValue(false);
    findManualNicheForProduct.mockResolvedValue(null);
    transitionStatus.mockResolvedValue(true);
    updateStatus.mockResolvedValue(undefined);
    publishOffer.mockResolvedValue({ status: "published", messageId: 1 });
    requestChannelApproval.mockResolvedValue({
      messageId: 42,
      status: "pending_approval",
    });
    classifyProductNicheDecision.mockReturnValue({
      niche: "electronics",
      confidence: "high",
      evidence: "official_category",
      automatic: true,
    });
  });

  it("publishes a high-confidence scheduled offer without approval", async () => {
    const result = await processNextScheduledOffer({
      debug: vi.fn(),
      warn: vi.fn(),
    } as never);

    expect(setPublicationNiche).toHaveBeenCalledWith(
      "offer-1",
      "electronics",
      "classifier",
      ["scheduled"],
    );
    expect(publishOffer).toHaveBeenCalledWith(
      "offer-1",
      "scheduled:offer-1",
      expect.anything(),
    );
    expect(result).toBe("published");
  });

  it("skips a recently published title before requesting a channel", async () => {
    wasRecentlyPublished.mockResolvedValue(true);
    const result = await processNextScheduledOffer({
      debug: vi.fn(),
      warn: vi.fn(),
    } as never);

    expect(transitionStatus).toHaveBeenCalledWith(
      "offer-1",
      ["scheduled"],
      "rejected",
      "RECENTLY_PUBLISHED",
    );
    expect(classifyProductNicheDecision).not.toHaveBeenCalled();
    expect(requestChannelApproval).not.toHaveBeenCalled();
    expect(publishOffer).not.toHaveBeenCalled();
    expect(result).toBe("idle");
  });

  it("keeps the repost cooldown after a manual channel choice", async () => {
    findNextScheduled.mockResolvedValue({
      id: "offer-1",
      productId: "product-1",
      status: "scheduled",
      publicationNiche: "hardware",
      publicationNicheSource: "manual",
    });
    wasRecentlyPublished.mockResolvedValue(true);
    const result = await processNextScheduledOffer({
      debug: vi.fn(),
      warn: vi.fn(),
    } as never);
    expect(result).toBe("idle");
    expect(publishOffer).not.toHaveBeenCalled();
  });

  it("also drains offers left in the approved status", async () => {
    findNextScheduled.mockResolvedValue({
      id: "offer-1",
      productId: "product-1",
      status: "approved",
      publicationNiche: null,
      publicationNicheSource: null,
    });

    await processNextScheduledOffer({
      debug: vi.fn(),
      warn: vi.fn(),
    } as never);

    expect(setPublicationNiche).toHaveBeenCalledWith(
      "offer-1",
      "electronics",
      "classifier",
      ["approved"],
    );
    expect(publishOffer).toHaveBeenCalledOnce();
  });

  it("reuses a verified previous channel choice without asking again", async () => {
    findManualNicheForProduct.mockResolvedValue("home_kitchen");
    classifyProductNicheDecision.mockReturnValue({
      niche: "general",
      automatic: false,
    });
    const result = await processNextScheduledOffer({
      debug: vi.fn(),
      warn: vi.fn(),
    } as never);
    expect(result).toBe("published");
    expect(setPublicationNiche).toHaveBeenCalledWith(
      "offer-1",
      "home_kitchen",
      "classifier",
      ["scheduled"],
    );
    expect(requestChannelApproval).not.toHaveBeenCalled();
  });

  it("returns an uncertain scheduled offer to channel approval", async () => {
    getProductById.mockResolvedValue({
      id: "product-1",
      title: "SSD NVMe 1 TB",
      category: null,
    });
    classifyProductNicheDecision.mockReturnValue({
      niche: "hardware",
      confidence: "medium",
      evidence: "title",
      automatic: false,
    });

    const result = await processNextScheduledOffer({
      debug: vi.fn(),
      warn: vi.fn(),
    } as never);

    expect(transitionStatus).toHaveBeenCalledWith(
      "offer-1",
      ["scheduled"],
      "pending_approval",
      "CHANNEL_SELECTION_REQUIRED",
    );
    expect(publishOffer).not.toHaveBeenCalled();
    expect(requestChannelApproval).toHaveBeenCalledWith(
      "offer-1",
      expect.objectContaining({ automatic: false }),
      expect.anything(),
    );
    expect(result).toBe("needs_channel_approval");
  });

  it("requeues an uncertain offer when channel approval delivery fails", async () => {
    classifyProductNicheDecision.mockReturnValue({
      niche: "hardware",
      confidence: "medium",
      evidence: "title",
      automatic: false,
    });
    requestChannelApproval.mockRejectedValue(new Error("telegram unavailable"));

    const result = await processNextScheduledOffer({
      debug: vi.fn(),
      warn: vi.fn(),
    } as never);

    expect(transitionStatus).toHaveBeenNthCalledWith(
      2,
      "offer-1",
      ["pending_approval"],
      "scheduled",
    );
    expect(result).toBe("retrying");
  });

  it("publishes an offer using its manual niche override", async () => {
    findNextScheduled.mockResolvedValue({
      id: "offer-1",
      productId: "product-1",
      publicationNiche: "fashion",
      publicationNicheSource: "manual",
    });

    const result = await processNextScheduledOffer({
      debug: vi.fn(),
      warn: vi.fn(),
    } as never);

    expect(setPublicationNiche).not.toHaveBeenCalled();
    expect(publishOffer).toHaveBeenCalledOnce();
    expect(result).toBe("published");
  });

  it("removes expired offers before processing the queue", async () => {
    findNextScheduled.mockResolvedValue(null);
    const logger = { debug: vi.fn(), warn: vi.fn() };

    await processNextScheduledOffer(logger as never);

    expect(expireScheduledOffers).toHaveBeenCalledOnce();
    expect(publishOffer).not.toHaveBeenCalled();
  });

  it("removes a permanently invalid offer from the head of the queue", async () => {
    publishOffer.mockRejectedValue(
      new AppError(
        "VALIDATION_FAILED",
        "Offer must have an image before publication",
        false,
      ),
    );
    const logger = { debug: vi.fn(), warn: vi.fn() };

    await processNextScheduledOffer(logger as never);

    expect(updateStatus).toHaveBeenCalledWith(
      "offer-1",
      "failed",
      "Offer must have an image before publication",
    );
    expect(logger.warn).toHaveBeenCalledOnce();
  });

  it("keeps a transiently blocked offer queued for a later retry", async () => {
    publishOffer.mockRejectedValue(
      new AppError(
        "VALIDATION_FAILED",
        "Minimum publication interval has not elapsed",
        true,
      ),
    );
    const logger = { debug: vi.fn(), warn: vi.fn() };

    await processNextScheduledOffer(logger as never);

    expect(updateStatus).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledOnce();
  });

  it("keeps the scheduler alive when reading the queue fails", async () => {
    findNextScheduled.mockRejectedValue(new Error("database unavailable"));
    const logger = { debug: vi.fn(), warn: vi.fn() };

    await expect(processNextScheduledOffer(logger as never)).resolves.toBe(
      "retrying",
    );

    expect(publishOffer).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledOnce();
  });
});
