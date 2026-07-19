import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Vitest configuration for the web-app.
 *
 * The only responsibility here is resolving the `@/*` path alias (mirrors the
 * `paths` entry in tsconfig.json) so that tests can import and mock modules the
 * same way the application code does — e.g. `vi.mock("@/hooks/useWallet")`.
 *
 * `globals` is intentionally left disabled: every test imports `describe` /
 * `it` / `expect` / `vi` explicitly. React-hook tests opt into the jsdom
 * environment per-file with a `// @vitest-environment jsdom` docblock, so the
 * default (node) stays fast for the pure-logic and adapter suites.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
