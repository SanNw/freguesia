import { describe, it, expect } from "vitest";
import { validateAffiliateUrl } from "../../src/domain/affiliate-link.js";

describe("validateAffiliateUrl", () => {
  it("rejects non-https when required", () => {
    const result = validateAffiliateUrl(
      "http://mercadolivre.com.br/product",
      ["mercadolivre.com.br"],
      true,
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("NOT_HTTPS");
  });

  it("rejects disallowed domain", () => {
    const result = validateAffiliateUrl(
      "https://evil.com/redirect",
      ["mercadolivre.com.br"],
      true,
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("DOMAIN_NOT_ALLOWED");
  });

  it("accepts valid https in allowed domain", () => {
    const result = validateAffiliateUrl(
      "https://mercadolivre.com.br/product?id=123",
      ["mercadolivre.com.br"],
      true,
    );
    expect(result.valid).toBe(true);
  });

  it("accepts subdomain of allowed domain", () => {
    const result = validateAffiliateUrl(
      "https://produto.mercadolivre.com.br/MLBU123",
      ["mercadolivre.com.br"],
      true,
    );
    expect(result.valid).toBe(true);
  });
});
