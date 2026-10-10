import { beforeEach, describe, expect, it, vi } from "vitest";

const query = vi.fn();

vi.mock("../../src/config/runtime.js", () => ({ telegramEnv: {} }));

vi.mock("../../src/adapters/persistence/db.js", () => ({
  db: { query },
}));

const { OfferRepository } =
  await import("../../src/adapters/persistence/offer-repository.js");

describe("offer publication routing persistence", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does not use an invalid GTIN to reuse a manual choice across stores", async () => {
    query
      .mockResolvedValueOnce([{ gtin: "4006381333932" }])
      .mockResolvedValueOnce([]);
    expect(
      await new OfferRepository().findManualNicheForProduct("product-1"),
    ).toBeNull();
    expect(query.mock.calls[1][1]).toEqual(["product-1", null]);
  });

  it("passes a checksum-verified canonical GTIN for channel reuse", async () => {
    query
      .mockResolvedValueOnce([{ gtin: "4006381333931" }])
      .mockResolvedValueOnce([{ publication_niche: "hardware" }]);
    expect(
      await new OfferRepository().findManualNicheForProduct("product-1"),
    ).toBe("hardware");
    expect(query.mock.calls[1][1]).toEqual(["product-1", "04006381333931"]);
  });

  it("maps a persisted manual publication niche", async () => {
    query.mockResolvedValue([
      {
        id: "0f48947c-5f5c-4a5b-9745-5b35df4dff17",
        product_id: "754e9572-1724-4c3f-a14e-da56093b8d44",
        source_observation_id: "1",
        status: "scheduled",
        score: 90,
        discount_percent: 40,
        affiliate_url: "https://example.com/offer",
        affiliate_provider: "test",
        image_url: "https://example.com/image.jpg",
        additional_image_urls: [],
        coupon_code: null,
        coupon_description: null,
        proposed_caption: "Oferta",
        rejection_reason: null,
        expires_at: null,
        idempotency_key: "offer-key",
        publication_niche: "fashion",
        publication_niche_source: "manual",
        created_at: "2026-08-30T10:00:00.000Z",
        updated_at: "2026-08-30T10:00:00.000Z",
      },
    ]);

    const offer = await new OfferRepository().getOffer(
      "0f48947c-5f5c-4a5b-9745-5b35df4dff17",
    );

    expect(offer?.publicationNiche).toBe("fashion");
    expect(offer?.publicationNicheSource).toBe("manual");
  });

  it("does not persist a choice from an unexpected status", async () => {
    query.mockResolvedValue([]);

    const updated = await new OfferRepository().setPublicationNiche(
      "0f48947c-5f5c-4a5b-9745-5b35df4dff17",
      "fashion",
      "manual",
      ["pending_approval"],
    );

    expect(updated).toBe(false);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("status = ANY($5::text[])"),
      [
        "fashion",
        "manual",
        "scheduled",
        "0f48947c-5f5c-4a5b-9745-5b35df4dff17",
        ["pending_approval"],
      ],
    );
  });
});
