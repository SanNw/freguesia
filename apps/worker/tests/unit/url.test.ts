import { describe, it, expect } from "vitest";
import {
  normalizeUrl,
  isAllowedDomain,
  isPrivateOrLoopback,
  validateExternalUrl,
} from "../../src/shared/url.js";

describe("normalizeUrl", () => {
  it("normalizes and removes hash", () => {
    const result = normalizeUrl("https://example.com/path?q=2#anchor");
    expect(result).toBe("https://example.com/path?q=2");
  });

  it("returns null for invalid URL", () => {
    expect(normalizeUrl("not-a-url")).toBeNull();
  });
});

describe("isAllowedDomain", () => {
  it("matches exact domain", () => {
    expect(isAllowedDomain("https://amazon.com.br/product", ["amazon.com.br"])).toBe(true);
  });

  it("matches subdomain", () => {
    expect(isAllowedDomain("https://www.amazon.com.br/product", ["amazon.com.br"])).toBe(true);
  });

  it("rejects unrelated domain", () => {
    expect(isAllowedDomain("https://evil.com/product", ["amazon.com.br"])).toBe(false);
  });
});

describe("isPrivateOrLoopback", () => {
  it("detects 127.x", () => {
    expect(isPrivateOrLoopback("127.0.0.1")).toBe(true);
  });

  it("detects 10.x", () => {
    expect(isPrivateOrLoopback("10.0.0.1")).toBe(true);
  });

  it("detects 192.168.x", () => {
    expect(isPrivateOrLoopback("192.168.1.1")).toBe(true);
  });

  it("does not flag public IP", () => {
    expect(isPrivateOrLoopback("8.8.8.8")).toBe(false);
  });
});

describe("validateExternalUrl", () => {
  it("rejects non-https when required", () => {
    const result = validateExternalUrl("http://example.com", ["example.com"], true);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("NOT_HTTPS");
  });

  it("rejects private IP", () => {
    const result = validateExternalUrl("https://127.0.0.1/path", ["127.0.0.1"], true);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("PRIVATE_IP");
  });

  it("rejects disallowed domain", () => {
    const result = validateExternalUrl("https://evil.com/path", ["amazon.com.br"], true);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("DOMAIN_NOT_ALLOWED");
  });

  it("accepts valid https allowed domain", () => {
    const result = validateExternalUrl("https://amazon.com.br/product", ["amazon.com.br"], true);
    expect(result.valid).toBe(true);
  });
});
