import { describe, expect, it, vi } from "vitest";
vi.mock("../../src/config/env.js", () => ({ env: {} }));
import { ProductComparisonService } from "../../src/application/product-comparison-service.js";

describe("honest product comparison", () => {
  it("compares reference specs without inventing offers, FPS or a benchmark winner", async () => {
    const service = new ProductComparisonService({
      search: async () => [],
      publishedProduct: async () => null,
    });
    const result = await service.compareProducts("RX 550", "GTX 1050 Ti");
    expect(result.markdown).toContain("50 W");
    expect(result.markdown).toContain("75 W");
    expect(result.markdown).toContain("Sem oferta atual verificada");
    expect(result.markdown).toContain("Não há benchmark");
    expect(result.choices).toEqual([]);
    expect(result.markdown).not.toMatch(/\d+\s*FPS|\d+% mais/);
  });
  it("shows only matched products with our verified affiliate link", async () => {
    const row = {
      offerId: "12345678-1234-4123-8123-123456789abc",
      title: "Placa RX 550 4GB",
      priceCents: 45000,
      affiliateUrl: "https://s.shopee.com.br/own",
      brand: "AMD",
      model: "RX 550",
    };
    const service = new ProductComparisonService({
      search: async () => [
        row,
        { ...row, title: "Cooler RX 550", model: "" },
        { ...row, affiliateUrl: "https://evil.example/" },
      ],
      publishedProduct: async () => null,
    });
    const result = await service.compareProducts("RX 550", "GTX 1050ti");
    expect(result.choices).toHaveLength(1);
    expect(result.choices[0]).toMatchObject({
      side: "left",
      affiliateUrl: row.affiliateUrl,
    });
    expect(result.markdown).toContain("450");
    expect(result.markdown).not.toContain("evil.example");
  });
  it("does not infer undocumented technical characteristics for generic products", async () => {
    const service = new ProductComparisonService({
      search: async () => [],
      publishedProduct: async () => null,
    });
    expect(
      (await service.compareProducts("fone marca A", "fone marca B")).markdown,
    ).toContain("Sem ficha técnica verificada");
  });
});
