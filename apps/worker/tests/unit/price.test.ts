import { describe, it, expect } from "vitest";
import {
  calculateDiscountPercent,
  validatePrice,
  formatBRL,
  parseBRLPrice,
} from "../../src/domain/price.js";

describe("calculateDiscountPercent", () => {
  it("returns 0 when no previous price", () => {
    expect(calculateDiscountPercent(4990, null)).toBe(0);
  });

  it("returns 0 when previous <= current", () => {
    expect(calculateDiscountPercent(4990, 4990)).toBe(0);
    expect(calculateDiscountPercent(5000, 4000)).toBe(0);
  });

  it("calculates discount correctly", () => {
    expect(calculateDiscountPercent(4990, 7990)).toBe(37.55);
  });

  it("returns 0 for zero or negative", () => {
    expect(calculateDiscountPercent(0, 7990)).toBe(0);
    expect(calculateDiscountPercent(4990, 0)).toBe(0);
  });
});

describe("validatePrice", () => {
  it("rejects zero or negative", () => {
    expect(validatePrice(0, 7990, 100, 5000000)).toEqual({
      valid: false,
      reason: "PRICE_ZERO_OR_NEGATIVE",
    });
  });

  it("rejects below minimum", () => {
    expect(validatePrice(50, 7990, 100, 5000000)).toEqual({
      valid: false,
      reason: "PRICE_BELOW_MINIMUM",
    });
  });

  it("rejects above maximum", () => {
    expect(validatePrice(6000000, 7990, 100, 5000000)).toEqual({
      valid: false,
      reason: "PRICE_ABOVE_MAXIMUM",
    });
  });

  it("rejects previous <= current", () => {
    expect(validatePrice(5000, 4000, 100, 5000000)).toEqual({
      valid: false,
      reason: "PREVIOUS_PRICE_NOT_GREATER",
    });
  });

  it("accepts valid price", () => {
    expect(validatePrice(4990, 7990, 100, 5000000)).toEqual({ valid: true });
  });
});

describe("formatBRL", () => {
  it("formats cents to BRL", () => {
    expect(formatBRL(4990)).toMatch(/R\$/);
  });
});

describe("parseBRLPrice", () => {
  it("parses R$ 49,90", () => {
    expect(parseBRLPrice("R$ 49,90")).toBe(4990);
  });

  it("parses R$ 1.234,56", () => {
    expect(parseBRLPrice("R$ 1.234,56")).toBe(123456);
  });

  it("returns null for invalid", () => {
    expect(parseBRLPrice("")).toBeNull();
    expect(parseBRLPrice("abc")).toBeNull();
  });
});
