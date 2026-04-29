import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Reference-only design handoff bundle from Claude Design — not our
    // code, just the source mockups we're porting from.
    "design/**",
    // Vitest coverage report — generated, gitignored, but we still
    // shouldn't let eslint complain about its dist files.
    "coverage/**",
  ]),
]);

export default eslintConfig;
