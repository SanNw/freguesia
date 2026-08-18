import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/config/env.js", () => ({
  env: {
    SOURCE_ALIEXPRESS_ENABLED: false,
    ALIEXPRESS_APP_KEY: "",
    ALIEXPRESS_APP_SECRET: "",
    ALIEXPRESS_TRACKING_ID: "",
    ALIEXPRESS_AFFILIATE_API_URL: "",
  },
}));

const {
  aliExpressReadiness,
  isAliExpressQueryMatch,
  preferNationalCandidates,
} = await import("../../src/adapters/sources/aliexpress.adapter.js");

describe("AliExpress adapter readiness", () => {
  it("stays disabled before API approval", () => {
    expect(
      aliExpressReadiness({
        enabled: false,
        apiUrl: "",
        appKey: "",
        secret: "",
        trackingId: "",
      }),
    ).toEqual({ ready: false, reason: "disabled" });
  });

  it("requires all affiliate credentials", () => {
    expect(
      aliExpressReadiness({
        enabled: true,
        apiUrl: "https://api.example",
        appKey: "key",
        secret: "",
        trackingId: "id",
      }).reason,
    ).toBe("credentials_missing");
  });

  it("becomes ready when the production configuration is complete", () => {
    expect(
      aliExpressReadiness({
        enabled: true,
        apiUrl: "https://api.example",
        appKey: "key",
        secret: "secret",
        trackingId: "id",
      }).ready,
    ).toBe(true);
  });
});

describe("AliExpress query relevance", () => {
  it("rejects a tarot deck that only mentions a Mouse edition", () => {
    expect(
      isAliExpressQueryMatch(
        "Baralho de cartas de tarô edição Mimi Mouse",
        "mouse gamer",
      ),
    ).toBe(false);
  });

  it("accepts a product containing all meaningful query terms", () => {
    expect(
      isAliExpressQueryMatch("Mouse gamer sem fio RGB", "mouse gamer"),
    ).toBe(true);
  });
});

describe("AliExpress shipping priority", () => {
  it("uses only national candidates when at least one is available", () => {
    const candidates = [
      { id: "international", shippingOrigin: "international" as const },
      { id: "national", shippingOrigin: "brazil" as const },
    ];
    expect(
      preferNationalCandidates(candidates, (item) => item.shippingOrigin),
    ).toEqual([{ id: "national", shippingOrigin: "brazil" }]);
  });

  it("keeps international candidates when there is no national option", () => {
    const candidates = [
      { id: "international", shippingOrigin: "international" as const },
    ];
    expect(
      preferNationalCandidates(candidates, (item) => item.shippingOrigin),
    ).toEqual(candidates);
  });
});
