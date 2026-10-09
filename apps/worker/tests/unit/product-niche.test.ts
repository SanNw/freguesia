import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/config/env.js", () => ({
  env: {
    TELEGRAM_PUBLIC_CHANNEL_ID: "general",
    TELEGRAM_CHANNEL_HARDWARE_ID: "hardware",
    TELEGRAM_CHANNEL_HOME_KITCHEN_ID: "home",
    TELEGRAM_CHANNEL_APPLIANCES_ID: "appliances",
    TELEGRAM_CHANNEL_BEAUTY_ID: "beauty",
    TELEGRAM_CHANNEL_ELECTRONICS_ID: "electronics",
    TELEGRAM_CHANNEL_FASHION_ID: "fashion",
  },
}));

const {
  classifyProductNiche,
  classifyProductNicheDecision,
  productNicheChannel,
} = await import("../../src/domain/product-niche.js");

describe("product niche routing", () => {
  it.each([
    ["Processador Triturador de Alimentos 170ml ou 500ml Univ", "appliances"],
    ["Processador Intel Core i7", "hardware"],
    ["SSD NVMe 1 TB", "hardware"],
    ["Notebook gamer com SSD", "electronics"],
    ["PC gamer completo Ryzen 7", "electronics"],
    ["Placa de vídeo GeForce RTX", "hardware"],
    ["Teclado mecânico USB", "hardware"],
    ["Kit de maquiagem e batom", "beauty"],
    ["Escova secadora para cabelo", "beauty"],
    ["Kit 3 Shorts 2 em 1 Compressão Bermuda Masculina Academia", "fashion"],
    ["Jaqueta masculina impermeável", "fashion"],
    ["Tênis feminino para caminhada", "fashion"],
    ["Bolsa feminina de couro", "fashion"],
    ["Gloss labial framboesa", "beauty"],
    ["Kit de adesivos para acne", "beauty"],
    ["Leave-in sérum capilar", "beauty"],
    ["Percarbonato tira manchas para roupas", "home_kitchen"],
    ["Air Fryer digital", "appliances"],
    ["Geladeira frost free", "appliances"],
    ["Jogo de panelas", "home_kitchen"],
    ["Jogo de cama com edredom", "home_kitchen"],
    ["Smartphone Galaxy A17 5G", "electronics"],
    ["Produto sem categoria conhecida", "general"],
    ["Baralho de tarô edição Mouse", "general"],
    ["Chocolate caixa de bombons sortidos", "general"],
    ["Cesta de alimentos para presente", "general"],
    ["Kit presente de aniversário", "general"],
  ])("classifies %s", (title, expected) => {
    expect(classifyProductNiche(title)).toBe(expected);
  });

  it("uses the general channel as fallback", () => {
    expect(productNicheChannel("general")).toBe("general");
  });

  it("routes fashion products to the dedicated channel", () => {
    expect(productNicheChannel("fashion")).toBe("fashion");
  });

  it.each([
    ["Refil sem descrição do aparelado", "MLB5726", "appliances"],
    ["Produto para cuidados pessoais", "MLB1246", "beauty"],
    ["Filamento PLA", "MLB1648", "hardware"],
    ["Cabo Patch Cord", "Periféricos > Cabos de Rede", "hardware"],
    [
      "Rádio retrô",
      "Eletrônicos, Áudio e Vídeo > Áudio > Rádios AM/FM",
      "electronics",
    ],
    [
      "Espremedor Premium",
      "Eletrodomésticos > Pequenos Eletrodomésticos > Espremedores Elétricos",
      "appliances",
    ],
    [
      "Aparador de pelos",
      "Beleza e Cuidado Pessoal > Máquinas de Cortar Cabelo",
      "beauty",
    ],
    [
      "Prancha profissional",
      "Beleza e Cuidado Pessoal > Pranchas de Cabelo",
      "beauty",
    ],
  ])("uses category %s as fallback", (title, category, expected) => {
    expect(classifyProductNiche(title, category)).toBe(expected);
  });

  it("prioritizes the ML category path over conflicting title terms", () => {
    expect(
      classifyProductNiche(
        "Kit 10 Pote De Vidro Marmita Hermética 370ml Freezer Fit",
        "Casa, Móveis e Decoração > Cozinha > Armazenamento e Organização > Potes para Alimentos",
      ),
    ).toBe("home_kitchen");
  });

  it.each([
    ["Mouse sem fio", "Celulares e Telefones > Acessórios", "electronics"],
    ["Notebook gamer", "Informática > Notebooks", "hardware"],
    ["Perfume importado", "Roupas e Acessórios > Moda Feminina", "fashion"],
    ["Smartwatch esportivo", "Esportes e Fitness > Corrida", "general"],
  ])(
    "prioritizes the official root category %s",
    (title, category, expected) => {
      expect(classifyProductNiche(title, category)).toBe(expected);
    },
  );

  it("classifies by title only when category is absent", () => {
    expect(
      classifyProductNiche(
        "Kit 10 Pote De Vidro Marmita Hermética 370ml Freezer Fit",
      ),
    ).toBe("general");
  });

  it("marks an official category path as safe for automatic routing", () => {
    expect(
      classifyProductNicheDecision(
        "Kit 10 Potes para freezer",
        "Casa, Moveis e Decoracao > Cozinha > Potes",
      ),
    ).toEqual({
      niche: "home_kitchen",
      confidence: "high",
      evidence: "official_category",
      automatic: true,
    });
  });

  it("routes conflicting title evidence to the safe general channel", () => {
    expect(
      classifyProductNicheDecision("Kit pote organizador para freezer"),
    ).toEqual({
      niche: "general",
      confidence: "low",
      evidence: "conflict",
      automatic: false,
    });
  });

  it("keeps a single title rule reviewable", () => {
    expect(classifyProductNicheDecision("SSD NVMe 1 TB")).toEqual({
      niche: "hardware",
      confidence: "medium",
      evidence: "title",
      automatic: false,
    });
  });

  it.each([
    ["Tênis Nike Free Metcon 6 Masculino", "Masculino > Calçados > Tênis", "fashion"],
    ["Mop Shark Steam Vapor 110V", null, "home_kitchen"],
    ["Secador Shark SpeedStyle - Cacheados e Crespos 110V", null, "beauty"],
    ["Attracione Men (Perfume Masculino com Feromônios Ativados)", null, "beauty"],
  ])("automatically routes observed obvious item %s", (title, category, niche) => {
    expect(classifyProductNicheDecision(title, category)).toMatchObject({
      niche,
      confidence: "high",
      automatic: true,
    });
  });

  it("keeps unclear items for review", () => {
    expect(classifyProductNicheDecision("150 Bolinhas Transparentes Extras").automatic).toBe(false);
  });
});
