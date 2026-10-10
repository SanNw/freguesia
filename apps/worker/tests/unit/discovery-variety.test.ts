import { describe, expect, it } from "vitest";
import { mercadoLivreDiscoveryQuery } from "../../src/domain/mercadolivre-discovery-plan.js";

describe("Mercado Livre category exploration", () => {
  it("visits distinct appliance families across consecutive cycles", () => {
    expect(mercadoLivreDiscoveryQuery("MLB5726", 0)).toBe("air fryer");
    expect(mercadoLivreDiscoveryQuery("MLB5726", 1)).toBe("geladeira");
    expect(mercadoLivreDiscoveryQuery("MLB5726", 2)).toBeNull();
    expect(mercadoLivreDiscoveryQuery("MLB5726", 3)).toBe("maquina de lavar");
  });
  it("covers housewares and preserves unknown categories", () => {
    expect(mercadoLivreDiscoveryQuery("MLB1574", 0)).toBe("jogo de panelas");
    expect(mercadoLivreDiscoveryQuery("unknown", 0)).toBeNull();
  });
});
