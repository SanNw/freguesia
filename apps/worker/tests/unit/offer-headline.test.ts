import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/config/env.js", () => ({
  env: {
    TELEGRAM_PUBLIC_CHANNEL_ID: "general",
    TELEGRAM_CHANNEL_HARDWARE_ID: "hardware",
    TELEGRAM_CHANNEL_HOME_KITCHEN_ID: "home",
    TELEGRAM_CHANNEL_APPLIANCES_ID: "appliances",
    TELEGRAM_CHANNEL_BEAUTY_ID: "beauty",
    TELEGRAM_CHANNEL_ELECTRONICS_ID: "electronics",
  },
}));

const { buildOfferHeadline } =
  await import("../../src/domain/offer-headline.js");

describe("offer headline", () => {
  it("highlights very large discounts", () => {
    expect(buildOfferHeadline("Galaxy A17", "MLB1055", 52)).toContain("52%");
  });

  it("uses the product name and niche language", () => {
    const headline = buildOfferHeadline("SSD NVMe 1 TB", "MLB1648", 25);
    expect(headline).toContain("SSD NVMe 1 TB");
    expect(headline).not.toContain("OFERTA NA FREGUESIA");
  });

  it("is deterministic for the same offer", () => {
    expect(buildOfferHeadline("Jogo de panelas", "MLB1574", 22)).toBe(
      buildOfferHeadline("Jogo de panelas", "MLB1574", 22),
    );
  });
});
