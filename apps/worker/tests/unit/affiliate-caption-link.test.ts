import { describe, expect, it } from "vitest";
import { buildAffiliateCaptionLink } from "../../src/domain/affiliate-caption-link.js";

describe("affiliate caption link", () => {
  const longUrl = `https://s.click.aliexpress.com/s/${"x".repeat(500)}`;

  it("hides a long affiliate URL behind a short call to action", () => {
    expect(buildAffiliateCaptionLink(longUrl)).toBe(
      `<a href="${longUrl}">🛒 Comprar com desconto</a>`,
    );
  });

  it("creates a stable representation that can be detected before publication", () => {
    const link = buildAffiliateCaptionLink(longUrl);
    expect(`Oferta\n${link}`.includes(link)).toBe(true);
  });
});
