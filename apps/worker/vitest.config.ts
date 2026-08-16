import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    env: {
      LOMADEE_API_KEY: "test-key",
      LOMADEE_CHANNEL_ID: "test-channel",
      AWIN_API_TOKEN: "test-token",
      AWIN_PUBLISHER_ID: "test-publisher",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.d.ts", "src/server.ts"],
    },
  },
});
