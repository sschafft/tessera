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
    include: [
      "lib/**/*.test.ts",
      // Route-level integration tests live next to the handlers they
      // exercise. Added 2026-05-04 with the first allocation-invariant
      // regression — colocated tests are the Next.js convention for
      // app router and easier to discover when editing the route.
      "app/**/*.test.ts",
      "app/**/*.test.tsx",
      "components/**/*.test.ts",
      "components/**/*.test.tsx",
    ],
    coverage: {
      provider: "v8",
      include: [
        "lib/scoring/**",
        "lib/superpowers/**",
        "lib/pattern/**",
        "lib/briefs/orchestrator.ts",
        "lib/briefs/library.ts",
      ],
    },
  },
});
