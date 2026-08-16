import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: ["**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@freguesia/product-matching": resolve(__dirname, "./index.ts"),
    },
  },
});
