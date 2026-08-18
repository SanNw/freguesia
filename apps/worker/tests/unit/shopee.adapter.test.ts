import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/config/env.js", () => ({
  env: {
    SOURCE_SHOPEE_ENABLED: false,
    SHOPEE_APP_ID: "",
    SHOPEE_SECRET: "",
    SHOPEE_AFFILIATE_API_URL: "",
  },
}));

const { shopeeReadiness } =
  await import("../../src/adapters/sources/shopee.adapter.js");

describe("Shopee adapter readiness", () => {
  it("stays disabled before API approval", () => {
    expect(shopeeReadiness({ enabled: false, appId: "", secret: "" })).toEqual({
      ready: false,
      reason: "disabled",
    });
  });

  it("reports missing credentials after activation", () => {
    expect(
      shopeeReadiness({ enabled: true, appId: "", secret: "" }).reason,
    ).toBe("credentials_missing");
  });

  it("waits for the official contract when credentials exist", () => {
    expect(
      shopeeReadiness({ enabled: true, appId: "app", secret: "secret" }).reason,
    ).toBe("api_contract_pending");
  });
});
