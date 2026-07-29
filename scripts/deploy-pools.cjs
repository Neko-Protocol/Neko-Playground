"use strict";
/**
 * deploy-pools.cjs
 *
 * Deploy liquidity pool contracts.
 *
 * Required env vars:
 *   DEPLOY_ADMIN_SECRET_KEY    — Stellar secret key with deployer role (offline only)
 *   STELLAR_RPC_URL            — Soroban RPC endpoint
 *   STELLAR_NETWORK_PASSPHRASE — Network passphrase
 */
const { requireSecret } = require("./lib/secret.cjs");

const secretKey = requireSecret("DEPLOY_ADMIN_SECRET_KEY");
const rpcUrl = requireSecret("STELLAR_RPC_URL");
const networkPassphrase = requireSecret("STELLAR_NETWORK_PASSPHRASE");

// TODO: implement pool deployment logic
console.log("Deploy admin key loaded. Deploying pools...");
