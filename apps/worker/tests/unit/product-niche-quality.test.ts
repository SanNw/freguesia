import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/config/runtime.js", () => ({ telegramEnv: {} }));
const { classifyProductNicheDecision: classify } =
  await import("../../src/domain/product-niche.js");

describe("editorial routing regression set", () => {
  it.each([
    ["SSD NVMe 1 TB", "hardware"],
    ["Pen Drive 64 GB", "hardware"],
    ["RTX 4060 8GB", "hardware"],
    ["Ryzen 7 5700X", "hardware"],
    ["Placa mãe B550", "hardware"],
    ["Airfryer 4 litros", "appliances"],
    ["AIR  FRYER digital", "appliances"],
    ["Micro ondas 30L", "appliances"],
    ["Ar condicionado split", "appliances"],
    ["Jogo de panelas", "home_kitchen"],
    ["Garrafa Térmica Nórdica Berlim Café 1L", "home_kitchen"],
    ["Smart TV 55 polegadas", "electronics"],
    ["Smartphone Samsung Galaxy A55", "electronics"],
    ["Tênis Adidas", "fashion"],
    ["Tênis infantil", "fashion"],
    ["TÊNIS ESPORTIVO LEVE MASCULINO FEMININO", "fashion"],
    ["Babuche infantil sandálias para meninos", "fashion"],
    ["Conjunto Feminino Calça Pantalona Blusa Musclee Tee", "fashion"],
    ["Secador de cabelo Taiff", "beauty"],
    ["Máscara de hidratação capilar pote 1kg", "beauty"],
    ["Tapete mousepad gamer", "hardware"],
    ["Kit pote organizador para freezer", "home_kitchen"],
    ["Mochila para notebook", "fashion"],
    ["Suporte para notebook", "hardware"],
    ["Monitor de pressão arterial", "general"],
    ["Boneca com saia", "general"],
    ["Mochila para boneca", "general"],
    ["Running shoes sneakers for men", "fashion"],
    ["1000 Peças Bolsa Elástico De Cabelo Feminino", "beauty"],
    ["Creatina Hardcore 300g", "general"],
    ["Kit Flores Enfeite Árvore de Natal", "home_kitchen"],
    [
      "Caixa Caixinha De Som Bluetooth Potente Pendrive Fm Sd Portatil Ipx6",
      "electronics",
    ],
    ["Caixinha de som Bluetooth com entrada para pen drive", "electronics"],
    ["Caixa som Bluetooth portatil", "electronics"],
    [
      "Kit Shampoo V-Floc Cera Tok Final Pneu Pretinho Restaurax Vonixx",
      "general",
    ],
    ["Shampoo automotivo para carro", "general"],
    ["Shampoo anticaspa para cabelos oleosos", "beauty"],
  ])("routes clear product %s automatically", (title, niche) => {
    expect(classify(title)).toMatchObject({ niche, automatic: true });
  });

  it.each([
    ["Notebook gamer", "Informática > Notebooks", "electronics"],
    ["Perfume importado", "Roupas e Acessórios > Moda Feminina", "beauty"],
    ["Smartwatch esportivo", "Esportes e Fitness > Corrida", "electronics"],
    [
      "Kit pote para freezer",
      "Casa, Móveis e Decoração > Cozinha",
      "home_kitchen",
    ],
    ["Produto", " Eletrodomésticos > Fritadeiras ", "appliances"],
    ["Produto", "mlb5726", "appliances"],
  ])("resolves %s using specific evidence", (title, category, niche) => {
    expect(classify(title, category)).toMatchObject({ niche, automatic: true });
  });

  it.each([
    "Amplificador de potência 1000W",
    "150 Bolinhas Transparentes Extras",
    "Kit jogo de taças e liquidificador",
    "Mesa gamer com suporte de monitor",
    "Kit notebook e geladeira",
    "Caixa de som e pendrive 64GB",
  ])("keeps ambiguous or mixed product %s reviewable", (title) => {
    expect(classify(title).automatic).toBe(false);
  });

  it("does not match pote inside potencia", () => {
    expect(classify("Amplificador de potência 1000W").niche).not.toBe(
      "home_kitchen",
    );
  });
});
