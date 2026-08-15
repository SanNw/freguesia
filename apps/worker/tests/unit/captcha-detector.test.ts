import { describe, it, expect } from "vitest";
import { detectCaptcha, detectBlocked } from "../../src/adapters/browser/captcha-detector.js";

describe("detectCaptcha", () => {
  it("detects recaptcha", () => {
    expect(detectCaptcha('<div class="g-recaptcha">')).toBe(true);
  });

  it("detects hcaptcha", () => {
    expect(detectCaptcha('<div class="h-captcha">')).toBe(true);
  });

  it("detects Portuguese captcha signal", () => {
    expect(detectCaptcha("Verifique que voce e humano")).toBe(true);
  });

  it("returns false for clean page", () => {
    expect(detectCaptcha("<html><body>Hello</body></html>")).toBe(false);
  });
});

describe("detectBlocked", () => {
  it("detects access denied", () => {
    expect(detectBlocked("Access Denied - 403")).toBe(true);
  });

  it("returns false for normal content", () => {
    expect(detectBlocked("Produto em promocao")).toBe(false);
  });
});
