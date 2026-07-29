"use strict";
/**
 * deploy-full.cjs
 *
 * Deploy the full contract suite (oracle, RWA tokens, pools).
 * DEPLOY_ADMIN_SECRET_KEY must be kept offline — never in CI or server env.
 *
 * Required env vars:
 *   DEPLOY_ADMIN_SECRET_KEY    — Stellar secret key with deployer role (offline only)
 *   STELLAR_RPC_URL            — Soroban RPC endpoint
 *   STELLAR_NETWORK_PASSPHRASE — Network passphrase
 *
 * Usage (run only from a secure, air-gapped or hardware-key session):
 *   export DEPLOY_ADMIN_SECRET_KEY=S...
 *   node scripts/deploy-full.cjs
 */
const { requireSecret } = require("./lib/secret.cjs");

const secretKey = requireSecret("DEPLOY_ADMIN_SECRET_KEY");
const rpcUrl = requireSecret("STELLAR_RPC_URL");
const networkPassphrase = requireSecret("STELLAR_NETWORK_PASSPHRASE");

// TODO: implement deploy logic
console.log("Deploy admin key loaded. Starting full deployment...");
