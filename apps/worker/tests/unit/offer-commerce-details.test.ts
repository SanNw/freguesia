import { describe, expect, it } from "vitest";
import { buildOfferCommerceDetails } from "../../src/domain/offer-commerce-details.js";

describe("offer commerce details", () => {
  it("shows confirmed interest-free installments", () => {
    expect(
      buildOfferCommerceDetails({
        installmentCount: 10,
        installmentValueCents: 1899,
        interestFree: true,
      }),
    ).toEqual([
      `💳 10x de ${new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(18.99)} sem juros`,
    ]);
  });

  it("highlights national shipping and product reputation", () => {
    expect(
      buildOfferCommerceDetails({
        shippingOrigin: "brazil",
        rating: 4.8,
        reviewCount: 1234,
      }),
    ).toEqual(["⭐ 4.8/5 (1.234 avaliações)", "🇧🇷 Envio nacional"]);
  });

  it("shows confirmed tax for an international product", () => {
    expect(
      buildOfferCommerceDetails({
        shippingOrigin: "international",
        taxAmountCents: 8750,
        taxIncluded: true,
        taxConfirmed: true,
      }),
    ).toEqual([
      "🌍 Produto internacional",
      `🧾 Impostos: ${new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(87.5)} (já incluídos)`,
    ]);
  });

  it("does not invent tax when the platform does not provide it", () => {
    expect(
      buildOfferCommerceDetails({ shippingOrigin: "international" }),
    ).toContain("🧾 Impostos podem ser calculados no checkout");
  });
});
