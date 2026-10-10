import { describe, expect, it } from "vitest";
import {
  normalizeProductTitle,
  validatedGtin,
} from "../../src/domain/product-identity.js";

describe("product identity", () => {
  it("normalizes superficial title differences without merging variants", () => {
    expect(normalizeProductTitle("  Garrafa TÉRMICA — 1L! ")).toBe(
      "garrafa termica 1l",
    );
    expect(normalizeProductTitle("SSD 1TB")).not.toBe(
      normalizeProductTitle("SSD 2TB"),
    );
  });
  it("accepts a checksum-valid GTIN and rejects malformed identifiers", () => {
    expect(validatedGtin("4006381333931")).toBe("04006381333931");
    expect(validatedGtin("4006381333932")).toBeNull();
    expect(validatedGtin("0000000000000")).toBeNull();
    expect(validatedGtin(null)).toBeNull();
  });
});
