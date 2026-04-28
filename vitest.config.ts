import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: [
        "lib/scoring/**",
        "lib/accelerants/**",
        "lib/pattern/**",
        "lib/briefs/orchestrator.ts",
        "lib/briefs/library.ts",
      ],
    },
  },
});
