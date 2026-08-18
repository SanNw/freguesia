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

const { classifyProductNiche, productNicheChannel } =
  await import("../../src/domain/product-niche.js");

describe("product niche routing", () => {
  it.each([
    ["SSD NVMe 1 TB", "hardware"],
    ["Notebook gamer com SSD", "electronics"],
    ["PC gamer completo Ryzen 7", "electronics"],
    ["Placa de vídeo GeForce RTX", "hardware"],
    ["Teclado mecânico USB", "hardware"],
    ["Kit de maquiagem e batom", "beauty"],
    ["Escova secadora para cabelo", "beauty"],
    ["Air Fryer digital", "appliances"],
    ["Geladeira frost free", "appliances"],
    ["Jogo de panelas", "home_kitchen"],
    ["Jogo de cama com edredom", "home_kitchen"],
    ["Smartphone Galaxy A17 5G", "electronics"],
    ["Produto sem categoria conhecida", "general"],
    ["Baralho de tarô edição Mouse", "general"],
  ])("classifies %s", (title, expected) => {
    expect(classifyProductNiche(title)).toBe(expected);
  });

  it("uses the general channel as fallback", () => {
    expect(productNicheChannel("general")).toBe("general");
  });

  it.each([
    ["Refil sem descrição do aparelho", "MLB5726", "appliances"],
    ["Produto para cuidados pessoais", "MLB1246", "beauty"],
    ["Filamento PLA", "MLB1648", "hardware"],
  ])("uses category %s as fallback", (title, category, expected) => {
    expect(classifyProductNiche(title, category)).toBe(expected);
  });
});
