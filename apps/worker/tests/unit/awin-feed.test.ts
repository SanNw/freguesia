import { readFile } from "node:fs/promises";
import { expect, it, vi } from "vitest";
import { loadAwinFeed } from "../../src/adapters/sources/awin-feed.js";

vi.mock("node:fs/promises", () => ({ readFile: vi.fn() }));

it("loads one feed at a time and preserves product order", async () => {
  let active = 0;
  let peak = 0;
  vi.mocked(readFile).mockImplementation(async (path) => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 0));
    active -= 1;
    return `aw_product_id,merchant_deep_link,search_price\n${path},https://example.com/${path},10\n`;
  });

  const products = await loadAwinFeed(" first.csv, second.csv ");
  expect(products.map((product) => product.externalId)).toEqual([
    "first.csv",
    "second.csv",
  ]);
  expect(peak).toBe(1);
  expect(products.every((product) => product.currentPriceCents === 1000)).toBe(
    true,
  );

  vi.mocked(readFile).mockRejectedValueOnce(new Error("feed unavailable"));
  await expect(loadAwinFeed("missing.csv")).rejects.toThrow("feed unavailable");
});
