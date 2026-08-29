/**
 * rebalance-vault.mjs
 *
 * Manually trigger a vault rebalance without the full invest cycle.
 *
 * Required env vars:
 *   VAULT_MANAGER_SECRET_KEY  — Stellar secret key with vault manager role
 *   STELLAR_RPC_URL           — Soroban RPC endpoint
 *   STELLAR_NETWORK_PASSPHRASE — Network passphrase
 *
 * Usage:
 *   export VAULT_MANAGER_SECRET_KEY=S...
 *   node scripts/rebalance-vault.mjs
 */
import { requireSecret } from "./lib/secret.mjs";

const secretKey = requireSecret("VAULT_MANAGER_SECRET_KEY");
const rpcUrl = requireSecret("STELLAR_RPC_URL");
const networkPassphrase = requireSecret("STELLAR_NETWORK_PASSPHRASE");

// TODO: implement rebalance logic
console.log("Vault manager key loaded. Starting rebalance...");
