/**
 * requireSecret(name) — CommonJS version for .cjs scripts.
 * See secret.mjs for full documentation.
 */
function requireSecret(name) {
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

module.exports = { requireSecret };
