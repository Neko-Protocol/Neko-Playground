/**
 * requireSecret(name)
 *
 * Read a secret from the environment and throw with a clear message when it is
 * absent or empty. Use this in every script that needs a signing key — never
 * embed key literals in source files.
 *
 * Usage:
 *   import { requireSecret } from "./lib/secret.mjs";
 *   const secretKey = requireSecret("VAULT_MANAGER_SECRET_KEY");
 *
 * Before running, export the variable:
 *   export VAULT_MANAGER_SECRET_KEY="S..."
 * or pass it inline:
 *   VAULT_MANAGER_SECRET_KEY="S..." node scripts/invest-vault.mjs
 */
export function requireSecret(name) {
  const val = process.env[name];
  if (!val || val.trim() === "") {
    console.error(
      `\n✖  Missing environment variable: ${name}\n` +
        `   Export it before running this script:\n` +
        `   export ${name}=<value>\n`
    );
    process.exit(1);
  }
  return val;
}
