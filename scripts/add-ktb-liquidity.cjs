"use strict";
/**
 * add-ktb-liquidity.cjs
 *
 * Add KTB liquidity to an AMM pool.
 *
 * Required env vars:
 *   VAULT_MANAGER_SECRET_KEY   — Stellar secret key with liquidity provider role
 *   STELLAR_RPC_URL            — Soroban RPC endpoint
 *   STELLAR_NETWORK_PASSPHRASE — Network passphrase
 */
const { requireSecret } = require("./lib/secret.cjs");

const secretKey = requireSecret("VAULT_MANAGER_SECRET_KEY");
const rpcUrl = requireSecret("STELLAR_RPC_URL");
const networkPassphrase = requireSecret("STELLAR_NETWORK_PASSPHRASE");

// TODO: implement add-liquidity logic
console.log("Vault manager key loaded. Adding KTB liquidity...");
