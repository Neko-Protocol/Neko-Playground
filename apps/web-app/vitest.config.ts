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
 *
 * `test.env` supplies the four required `NEXT_PUBLIC_STELLAR_*` vars that
 * `src/lib/env.client.ts` validates at import time. That module throws on
 * missing config by design, and Vitest — unlike Next.js — does not read
 * `.env.local`, so without these every suite that transitively imports it
 * fails. Pinning public testnet values here keeps the suite hermetic: it
 * behaves identically on a fresh clone and in CI, with no secrets involved.
 *
 * `esbuild.jsx` overrides the `jsx: "preserve"` this project's shared
 * tsconfig sets for Next.js's own SWC-based build pipeline — Vitest's
 * esbuild transform needs an actual JSX transform (not "preserve") to parse
 * `.tsx` component tests, which this config previously had no need to run.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    setupFiles: ["./vitest.setup.ts"],
  },
  oxc: {
    jsx: { runtime: "automatic" },
  },
  test: {
    env: {
      NEXT_PUBLIC_STELLAR_NETWORK: "TESTNET",
      NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE:
        "Test SDF Network ; September 2015",
      NEXT_PUBLIC_STELLAR_RPC_URL: "https://soroban-testnet.stellar.org",
      NEXT_PUBLIC_STELLAR_HORIZON_URL: "https://horizon-testnet.stellar.org",
    },
  },
});
