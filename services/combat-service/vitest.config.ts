/// <reference types="vitest" />

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node", 
    globals: true,   
    clearMocks: true, 
    restoreMocks: true,
    mockReset: true,
    include: ["tests/**/*.spec.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      reportsDirectory: "./coverage",
      exclude: [
        "node_modules/",
        "tests/",
        "**/*.d.ts",
        "**/migrations/**",
      ],
    },
  },
});
