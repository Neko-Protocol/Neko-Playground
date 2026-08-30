import { z } from "zod";

/**
 * Centralized, validated SERVER environment.
 *
 * Single source of truth for server-only variables — signing keys and
 * third-party credentials that must NEVER reach the browser bundle. The
 * runtime guard below throws if this module is ever imported in the
 * browser, so an accidental client import fails loudly.
 *
 * Per the project decision, only the core Stellar network config fails
 * fast (see `env.client.ts`). Integration secrets here are optional at the
 * schema level so the app can boot without every anchor / faucet / vault
 * configured; each integration still surfaces a clear error when its route
 * is actually used (see `requireServerEnv`).
 */

if (typeof window !== "undefined") {
  throw new Error(
    "env.server.ts was imported in the browser. Server-only secrets must " +
      "never reach the client bundle — import from env.client.ts instead."
  );
}

const serverSchema = z.object({
  // Vault manager signing key (server-only)
  VAULT_MANAGER_SECRET_KEY: z.string().optional(),

  // Job ledger persistence (server-only) — see lib/jobs
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),

  // Faucet (server-only)
  FAUCET_SECRET_KEY: z.string().optional(),
  FAUCET_CONTRACT_ID: z.string().optional(),

  // Etherfuse anchor
  ETHERFUSE_API_KEY: z.string().optional(),
  ETHERFUSE_BASE_URL: z.string().url().optional(),

  // Alfred Pay anchor
  ALFREDPAY_API_KEY: z.string().optional(),
  ALFREDPAY_API_SECRET: z.string().optional(),
  ALFREDPAY_BASE_URL: z.string().url().optional(),

  // Event platform (outbox/queue/delivery) — server-only
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
});

const parsed = serverSchema.safeParse({
  VAULT_MANAGER_SECRET_KEY: process.env.VAULT_MANAGER_SECRET_KEY,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  FAUCET_SECRET_KEY: process.env.FAUCET_SECRET_KEY,
  FAUCET_CONTRACT_ID: process.env.FAUCET_CONTRACT_ID,
  ETHERFUSE_API_KEY: process.env.ETHERFUSE_API_KEY,
  ETHERFUSE_BASE_URL: process.env.ETHERFUSE_BASE_URL,
  ALFREDPAY_API_KEY: process.env.ALFREDPAY_API_KEY,
  ALFREDPAY_API_SECRET: process.env.ALFREDPAY_API_SECRET,
  ALFREDPAY_BASE_URL: process.env.ALFREDPAY_BASE_URL,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
});

if (!parsed.success) {
  // Only malformed values (e.g. a non-URL base URL) land here, since every
  // field is optional. Still fail fast with a readable, aggregated error.
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("\n");
  throw new Error(`Invalid server environment variables:\n${issues}`);
}

/**
 * Validated, typed server environment. Import instead of `process.env.X`.
 */
export const serverEnv = parsed.data;

export type ServerEnv = typeof serverEnv;

/**
 * Assert that the given server env vars are present, throwing a clear error
 * naming the missing ones. Use at the start of a route/handler that needs
 * them, so a misconfiguration fails with a readable message instead of an
 * opaque downstream crash.
 */
export function requireServerEnv<K extends keyof ServerEnv>(
  keys: readonly K[]
): { [P in K]: NonNullable<ServerEnv[P]> } {
  const missing = keys.filter((k) => !serverEnv[k]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required server environment variables: ${missing.join(", ")}`
    );
  }
  return Object.fromEntries(keys.map((k) => [k, serverEnv[k]])) as {
    [P in K]: NonNullable<ServerEnv[P]>;
  };
}
