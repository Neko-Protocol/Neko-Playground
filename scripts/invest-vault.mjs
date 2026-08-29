/**
 * invest-vault.mjs
 *
 * Manually trigger the vault invest cycle (harvest → rebalance → collect fees).
 * In production this runs automatically via the Vercel cron at /api/vault/invest.
 * Use this script for testing or emergency manual runs.
 *
 * Required env vars:
 *   VAULT_MANAGER_SECRET_KEY  — Stellar secret key with vault manager role
 *   STELLAR_RPC_URL           — Soroban RPC endpoint
 *   STELLAR_NETWORK_PASSPHRASE — Network passphrase
 *
 * Usage:
 *   export VAULT_MANAGER_SECRET_KEY=S...
 *   export STELLAR_RPC_URL=https://soroban-testnet.stellar.org
 *   export STELLAR_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
 *   node scripts/invest-vault.mjs
 */
import { requireSecret } from "./lib/secret.mjs";

const secretKey = requireSecret("VAULT_MANAGER_SECRET_KEY");
const rpcUrl = requireSecret("STELLAR_RPC_URL");
const networkPassphrase = requireSecret("STELLAR_NETWORK_PASSPHRASE");

// TODO: implement invest logic using secretKey, rpcUrl, networkPassphrase
// Mirror the logic in apps/web-app/src/app/api/vault/invest/route.ts
console.log("Vault manager public key loaded. Starting invest cycle...");
