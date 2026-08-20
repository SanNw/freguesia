import { describe, it, expect } from "vitest";
import {
  generateExternalId,
  generateIdempotencyKey,
  isUnchangedPrice,
  isUrlValid,
} from "../../src/application/offer-helpers.js";

describe("generateExternalId", () => {
  it("produces consistent SHA-256 hash of canonical URL", () => {
    const url = "https://example.com/product/123";
    const id1 = generateExternalId(url);
    const id2 = generateExternalId(url);
    expect(id1).toBe(id2);
    expect(id1).toHaveLength(32);
  });

  it("produces different IDs for different URLs", () => {
    const id1 = generateExternalId("https://example.com/product/123");
    const id2 = generateExternalId("https://example.com/product/456");
    expect(id1).not.toBe(id2);
  });

  it("produces only hex characters", () => {
    const id = generateExternalId("https://example.com/product");
    expect(id).toMatch(/^[0-9a-f]+$/);
  });
});

describe("isUnchangedPrice", () => {
  it("skips a product only when its last observed price is unchanged", () => {
    expect(isUnchangedPrice(4990, 4990)).toBe(true);
    expect(isUnchangedPrice(5990, 4990)).toBe(false);
    expect(isUnchangedPrice(null, 4990)).toBe(false);
  });
});

describe("generateIdempotencyKey", () => {
  it("produces consistent key for same inputs within same hour", () => {
    const nowIso = "2026-08-15T18:30:00.000Z";
    const key1 = generateIdempotencyKey("manual", "abc123", 4990, nowIso);
    const key2 = generateIdempotencyKey(
      "manual",
      "abc123",
      4990,
      "2026-08-15T18:45:00.000Z",
    );
    expect(key1).toBe(key2);
  });

  it("produces different keys for different hours", () => {
    const key1 = generateIdempotencyKey(
      "manual",
      "abc123",
      4990,
      "2026-08-15T18:30:00.000Z",
    );
    const key2 = generateIdempotencyKey(
      "manual",
      "abc123",
      4990,
      "2026-08-15T19:30:00.000Z",
    );
    expect(key1).not.toBe(key2);
  });

  it("produces different keys for different prices", () => {
    const nowIso = "2026-08-15T18:30:00.000Z";
    const key1 = generateIdempotencyKey("manual", "abc123", 4990, nowIso);
    const key2 = generateIdempotencyKey("manual", "abc123", 5990, nowIso);
    expect(key1).not.toBe(key2);
  });

  it("produces different keys for different external IDs", () => {
    const nowIso = "2026-08-15T18:30:00.000Z";
    const key1 = generateIdempotencyKey("manual", "abc123", 4990, nowIso);
    const key2 = generateIdempotencyKey("manual", "def456", 4990, nowIso);
    expect(key1).not.toBe(key2);
  });

  it("produces only hex characters", () => {
    const key = generateIdempotencyKey(
      "manual",
      "abc123",
      4990,
      "2026-08-15T18:30:00.000Z",
    );
    expect(key).toMatch(/^[0-9a-f]+$/);
  });
});

describe("isUrlValid", () => {
  it("returns true for valid URL", () => {
    expect(isUrlValid("https://example.com/product")).toBe(true);
  });

  it("returns true for valid URL with query params", () => {
    expect(isUrlValid("https://example.com/product?id=123&ref=aff")).toBe(true);
  });

  it("returns false for null", () => {
    expect(isUrlValid(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isUrlValid(undefined)).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isUrlValid("")).toBe(false);
  });

  it("returns false for invalid URL string", () => {
    expect(isUrlValid("not-a-url")).toBe(false);
  });

  it("returns false for string without protocol", () => {
    expect(isUrlValid("example.com/product")).toBe(false);
  });
});
