import { describe, expect, it } from "vitest";
import {
  parseComparisonCommand,
  matchesComparisonQuery,
} from "../../src/domain/product-comparison.js";
import { technicalProfile } from "../../src/domain/technical-product-profiles.js";

describe("comparison input and exact models", () => {
  it("parses a command with the bot suffix and flexible spacing", () => {
    expect(
      parseComparisonCommand(
        "/comparar@freguesiapromobot rx 550 vs gtx 1050ti",
      ),
    ).toEqual({ left: "rx 550", right: "gtx 1050ti" });
  });
  it.each([
    "/comparar rx 550",
    "/comparar vs rx 550",
    "/comparar a vs b vs c",
    "/comparar https://example.com vs b",
  ])("rejects malformed input %s", (text) => {
    expect(parseComparisonCommand(text)).toBeNull();
  });
  it("distinguishes neighboring GPU models", () => {
    expect(
      matchesComparisonQuery("RX 550", "Placa de vídeo Radeon RX 550 4GB"),
    ).toBe(true);
    expect(matchesComparisonQuery("RX 550", "Placa de vídeo RX 5500 XT")).toBe(
      false,
    );
    expect(
      matchesComparisonQuery("GTX 1050 Ti", "Placa de vídeo GTX 1050 2GB"),
    ).toBe(false);
    expect(matchesComparisonQuery("GTX 1050ti", "Placa GTX 1050 Ti 4GB")).toBe(
      true,
    );
    expect(matchesComparisonQuery("RX 550", "Cooler para placa RX 550")).toBe(
      false,
    );
  });
  it("does not apply a profile to an accessory or another model", () => {
    expect(technicalProfile("RX 550")?.powerWatts).toBe(50);
    expect(technicalProfile("GTX 1050ti")?.powerWatts).toBe(75);
    expect(technicalProfile("RX 5500")).toBeNull();
    expect(technicalProfile("Cooler RX 550")).toBeNull();
  });
});
