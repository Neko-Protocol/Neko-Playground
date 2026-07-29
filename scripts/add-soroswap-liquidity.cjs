"use strict";
/**
 * add-soroswap-liquidity.cjs
 *
 * Add liquidity to a Soroswap pool.
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

// TODO: implement Soroswap add-liquidity logic
console.log("Vault manager key loaded. Adding Soroswap liquidity...");
