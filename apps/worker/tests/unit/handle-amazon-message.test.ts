import { describe, expect, it } from "vitest";
import { parseAmazonCommand } from "../../src/application/amazon-command.js";

describe("parseAmazonCommand", () => {
  it("parses a SiteStripe offer with Brazilian prices", () => {
    const result = parseAmazonCommand(`/amazon
Titulo: Cafeteira eletrica
Preco atual: R$ 199,90
Preco anterior: R$ 249,90
Link afiliado: https://amzn.to/teste
Imagem: https://example.com/main.jpg
Imagens extras: https://example.com/2.jpg, https://example.com/3.jpg
Cupom: CAFE20
Descricao do cupom: Aplicar no carrinho`);

    expect(result.currentPriceCents).toBe(19990);
    expect(result.previousPriceCents).toBe(24990);
    expect(result.additionalImages).toHaveLength(2);
    expect(result.couponCode).toBe("CAFE20");
  });

  it("requires the essential fields", () => {
    expect(() => parseAmazonCommand("/amazon\nTitulo: Incompleto")).toThrow(
      "Preencha Titulo",
    );
  });
});
