import { z } from "zod";
import { Networks as WalletNetwork } from "@creit.tech/stellar-wallets-kit/types";

/**
 * Centralized, validated CLIENT environment.
 *
 * Single source of truth for every `NEXT_PUBLIC_*` variable the app reads.
 * These values are inlined into the browser bundle by Next.js, so ONLY
 * non-secret configuration lives here. Server-only secrets belong in
 * `env.server.ts`.
 *
 * The core Stellar network vars are REQUIRED and fail fast at import time
 * with a single aggregated error, instead of each call site silently
 * falling back to testnet / an empty string. Optional public vars are
 * typed but may be undefined.
 *
 * IMPORTANT: every `process.env.NEXT_PUBLIC_*` access below is written as a
 * static literal so Next.js can statically replace it at build time. Do not
 * refactor these into a dynamic lookup.
 */

const clientSchema = z.object({
  // --- Core Stellar network (REQUIRED — fail fast) ---
  NEXT_PUBLIC_STELLAR_NETWORK: z.enum([
    "PUBLIC",
    "FUTURENET",
    "TESTNET",
    "LOCAL",
    "STANDALONE", // deprecated in favor of LOCAL
  ] as const),
  NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE: z.nativeEnum(WalletNetwork),
  NEXT_PUBLIC_STELLAR_RPC_URL: z.string().url(),
  NEXT_PUBLIC_STELLAR_HORIZON_URL: z.string().url(),

  // --- Optional public config ---
  NEXT_PUBLIC_LENDING_ADMIN_ADDRESS: z.string().optional(),
  NEXT_PUBLIC_FAUCET_CONTRACT_ID: z.string().optional(),
  NEXT_PUBLIC_SOROSWAP_API_KEY: z.string().optional(),
  NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: z.string().optional(),
  NEXT_PUBLIC_VERBOSE_LOGGING: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});

// Static references so Next.js inlines them into the client bundle.
const rawClientEnv = {
  NEXT_PUBLIC_STELLAR_NETWORK: process.env.NEXT_PUBLIC_STELLAR_NETWORK,
  NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE:
    process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE,
  NEXT_PUBLIC_STELLAR_RPC_URL: process.env.NEXT_PUBLIC_STELLAR_RPC_URL,
  NEXT_PUBLIC_STELLAR_HORIZON_URL: process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL,
  NEXT_PUBLIC_LENDING_ADMIN_ADDRESS:
    process.env.NEXT_PUBLIC_LENDING_ADMIN_ADDRESS,
  NEXT_PUBLIC_FAUCET_CONTRACT_ID: process.env.NEXT_PUBLIC_FAUCET_CONTRACT_ID,
  NEXT_PUBLIC_SOROSWAP_API_KEY: process.env.NEXT_PUBLIC_SOROSWAP_API_KEY,
  NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID:
    process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
  NEXT_PUBLIC_VERBOSE_LOGGING: process.env.NEXT_PUBLIC_VERBOSE_LOGGING,
};

const parsed = clientSchema.safeParse(rawClientEnv);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("\n");
  throw new Error(
    `Invalid or missing public environment variables:\n${issues}\n\n` +
      `Set these in apps/web-app/.env.local (see README "Environment configuration").`
  );
}

const parsedEnv = parsed.data;

/**
 * Validated, typed public environment.
 * Import these instead of touching `process.env.NEXT_PUBLIC_*` directly.
 */
export const clientEnv = {
  stellarNetwork:
    parsedEnv.NEXT_PUBLIC_STELLAR_NETWORK === "STANDALONE"
      ? ("LOCAL" as const)
      : parsedEnv.NEXT_PUBLIC_STELLAR_NETWORK,
  networkPassphrase: parsedEnv.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE,
  rpcUrl: parsedEnv.NEXT_PUBLIC_STELLAR_RPC_URL,
  horizonUrl: parsedEnv.NEXT_PUBLIC_STELLAR_HORIZON_URL,
  lendingAdminAddress: parsedEnv.NEXT_PUBLIC_LENDING_ADMIN_ADDRESS ?? "",
  faucetContractId: parsedEnv.NEXT_PUBLIC_FAUCET_CONTRACT_ID ?? "",
  soroswapApiKey: parsedEnv.NEXT_PUBLIC_SOROSWAP_API_KEY ?? "",
  walletConnectProjectId: parsedEnv.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "",
  verboseLogging: parsedEnv.NEXT_PUBLIC_VERBOSE_LOGGING ?? false,
} as const;

export type ClientEnv = typeof clientEnv;
