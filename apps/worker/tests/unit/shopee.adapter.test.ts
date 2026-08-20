import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/config/env.js", () => ({
  env: {
    SOURCE_SHOPEE_ENABLED: false,
    SHOPEE_APP_ID: "",
    SHOPEE_SECRET: "",
    SHOPEE_AFFILIATE_API_URL: "",
  },
}));

const { shopeeAuthorization, shopeeReadiness } =
  await import("../../src/adapters/sources/shopee.adapter.js");

describe("Shopee adapter", () => {
  it("reports configuration readiness", () => {
    expect(
      shopeeReadiness({ enabled: false, apiUrl: "", appId: "", secret: "" }),
    ).toEqual({ ready: false, reason: "disabled" });
    expect(
      shopeeReadiness({
        enabled: true,
        apiUrl: "https://example.com/graphql",
        appId: "app",
        secret: "secret",
      }),
    ).toEqual({ ready: true, reason: "ready" });
  });

  it("signs the exact request payload with SHA-256", () => {
    const payload = JSON.stringify({ query: "{ productOfferV2 { nodes { itemId } } }" });
    const timestamp = 1_577_836_800;
    const signature = createHash("sha256")
      .update(`123456${timestamp}${payload}demo`)
      .digest("hex");
    expect(shopeeAuthorization("123456", "demo", payload, timestamp)).toBe(
      `SHA256 Credential=123456, Timestamp=${timestamp}, Signature=${signature}`,
    );
  });
});
