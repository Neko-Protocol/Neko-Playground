#!/usr/bin/env bash
# =============================================================================
# generate-error-contract-stellar-enums.bash
#
# Generates TypeScript enum files from Soroban (Stellar) contract error
# definitions. Auto-discovers all contracts under:
#   apps/contracts/stellar-contracts/{contract-name}/
#
# Expected architecture per contract:
#   src/common/error.rs  ← must contain a #[contracterror] enum
#
# Output (one folder per contract):
#   apps/web-app/src/lib/constants/generated/contract-errors-{name}/index.ts
#
# Exits with a non-zero status and a descriptive error message if any contract
# directory does not follow the expected architecture.
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
STELLAR_DIR="$REPO_ROOT/apps/contracts/stellar-contracts"
OUTPUT_BASE="$REPO_ROOT/apps/web-app/src/lib/constants/generated"
GENERATED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

# Subdirectories inside stellar-contracts that are NOT smart contracts
SKIP_DIRS=("integration_tests" "scripts" "docs")

# ── Validate root directory ───────────────────────────────────────────────────
if [[ ! -d "$STELLAR_DIR" ]]; then
  echo "❌ ERROR: Stellar contracts directory not found." >&2
  echo "   Expected: $STELLAR_DIR" >&2
  exit 1
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Stellar Contract Error Enum Generator"
echo "  Source : $STELLAR_DIR"
echo "  Output : $OUTPUT_BASE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

stellar_contracts=()
found_contracts=0

for contract_dir in "$STELLAR_DIR"/*/; do
  [[ -d "$contract_dir" ]] || continue

  contract_name="$(basename "$contract_dir")"

  # ── Skip non-contract directories ────────────────────────────────────────────
  skip=0
  for skip_dir in "${SKIP_DIRS[@]}"; do
    [[ "$contract_name" == "$skip_dir" ]] && skip=1 && break
  done
  [[ $skip -eq 1 ]] && continue

  echo ""
  echo "📦 Contract: $contract_name"

  error_file="$contract_dir/src/common/error.rs"

  # ── Architecture validation ───────────────────────────────────────────────────
  if [[ ! -f "$error_file" ]]; then
    echo "❌ ERROR: Architecture mismatch for contract '$contract_name'" >&2
    echo "   Expected : src/common/error.rs" >&2
    echo "   Not found: $error_file" >&2
    echo "" >&2
    echo "   → Every Soroban contract must define its errors at src/common/error.rs" >&2
    exit 1
  fi

  if ! grep -q '#\[contracterror\]' "$error_file"; then
    echo "❌ ERROR: '$error_file' is missing the #[contracterror] attribute" >&2
    echo "   → The enum must be annotated with #[contracterror] to be a valid Soroban error source" >&2
    exit 1
  fi

  out_dir="$OUTPUT_BASE/contract-errors-stellar-$contract_name"
  mkdir -p "$out_dir"
  out_file="$out_dir/index.ts"

  # ── Parse & generate via Node.js (heredoc, no shell-variable expansion inside) ─
  CONTRACT_NAME="$contract_name" \
  ERROR_FILE="$error_file" \
  OUT_FILE="$out_file" \
  GENERATED_AT="$GENERATED_AT" \
  RELATIVE_SOURCE="apps/contracts/stellar-contracts/$contract_name/src/common/error.rs" \
  node << 'NODE_SCRIPT'
const fs = require('fs');

const contractName   = process.env.CONTRACT_NAME;
const errorFile      = process.env.ERROR_FILE;
const outFile        = process.env.OUT_FILE;
const generatedAt    = process.env.GENERATED_AT;
const relativeSource = process.env.RELATIVE_SOURCE;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Split PascalCase / CamelCase into space-separated words, preserving runs of
 *  consecutive capitals (e.g. "CDPNotInsolvent" → "CDP Not Insolvent"). */
function splitCamelCase(str) {
  return str
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .trim();
}

/** Convert kebab-case or snake_case to PascalCase prefix for TypeScript identifiers. */
function toPascalCase(str) {
  return str
    .split(/[-_]/)
    .map(s => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');
}

// ── Parse Rust #[contracterror] enum ─────────────────────────────────────────
const content = fs.readFileSync(errorFile, 'utf8');
const lines   = content.split('\n');

let inEnum     = false;
let braceDepth = 0;
let pendingMsg = null;    // populated by /// doc-comments or inline // comments
const entries  = [];      // { name: string, code: number, message: string }

for (const rawLine of lines) {
  const line = rawLine.trim();

  // ── Find the opening of pub enum Error ───────────────────────────────────────
  if (!inEnum) {
    if (/pub\s+enum\s+Error/.test(line)) {
      inEnum     = true;
      braceDepth = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
    }
    continue;
  }

  // ── Track brace depth; exit when the enum block closes ───────────────────────
  const opens  = (line.match(/\{/g) || []).length;
  const closes = (line.match(/\}/g) || []).length;
  braceDepth  += opens - closes;
  if (braceDepth <= 0) break;

  // ── /// doc-comment → message candidate (highest priority) ───────────────────
  if (/^\/\/\//.test(line)) {
    const text = line.replace(/^\/\/\/\s*/, '').trim();
    if (text) pendingMsg = text;
    continue;
  }

  // ── // section-comment → reset; section headers are NOT variant messages ──────
  if (/^\/\//.test(line)) {
    pendingMsg = null;
    continue;
  }

  // ── Variant line: Name = N,  (optional trailing // inline comment) ────────────
  // Examples:
  //   NotAuthorized = 1,
  //   MarginTokenNotSet = 73,   // Margin token not configured
  const m = line.match(/^(\w+)\s*=\s*(\d+)\s*,?\s*(?:\/\/\s*(.+))?$/);
  if (m) {
    const [, name, codeStr, inlineComment] = m;
    const code    = parseInt(codeStr, 10);
    // Priority: /// doc-comment > inline // comment > derived from variant name
    const message = pendingMsg
      || (inlineComment ? inlineComment.trim() : null)
      || splitCamelCase(name);
    entries.push({ name, code, message });
    pendingMsg = null;
    continue;
  }

  // Any non-blank, non-comment line resets the pending doc-comment
  if (line && !/^\/\//.test(line)) {
    pendingMsg = null;
  }
}

if (entries.length === 0) {
  process.stderr.write(
    `❌ ERROR: No enum variants parsed from ${errorFile}\n` +
    `   → Verify the file contains a well-formed #[contracterror] enum\n`
  );
  process.exit(1);
}

// ── Build TypeScript source ───────────────────────────────────────────────────
const prefix    = toPascalCase(contractName);   // e.g. "rwa-lending" → "RwaLending"
const enumName  = `${prefix}ErrorCode`;         // RwaLendingErrorCode
const constName = `${prefix}Errors`;            // RwaLendingErrors
const entryType = `${prefix}ErrorEntry`;        // RwaLendingErrorEntry

const enumBody = entries
  .map(e => `  ${e.name} = ${e.code},`)
  .join('\n');

const constBody = entries
  .map(e =>
    `  [${enumName}.${e.name}]: {\n` +
    `    code: "${e.name}",\n` +
    `    message: "${e.message.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}",\n` +
    `    contract: "${contractName}",\n` +
    `  },`
  )
  .join('\n');

const ts =
`/**
 * AUTO-GENERATED FILE – DO NOT EDIT
 *
 * Generated from : ${relativeSource}
 * Run            : bash apps/web-app/scripts/generate-error-contract-stellar-enums.bash
 * Generated at   : ${generatedAt}
 */

export interface ${entryType} {
  readonly code: string;
  readonly message: string;
  readonly contract: string;
}

/** Numeric error codes for the ${contractName} Soroban contract */
export enum ${enumName} {
${enumBody}
}

/** Full error info keyed by numeric code – property order: code → message → contract */
export const ${constName}: { readonly [K in ${enumName}]: ${entryType} } = {
${constBody}
} as const;

/** Union of all error names defined in ${contractName} */
export type ${prefix}ErrorName = keyof typeof ${constName};
`;

fs.writeFileSync(outFile, ts, 'utf8');
console.log(`   ✅ Written → ${outFile.replace(/\\/g, '/')}  (${entries.length} errors)`);
NODE_SCRIPT

  found_contracts=$((found_contracts + 1))
  stellar_contracts+=("$contract_name")
done

echo ""
if [[ $found_contracts -eq 0 ]]; then
  echo "❌ ERROR: No Soroban contract directories found in $STELLAR_DIR" >&2
  exit 1
fi

# ── Regenerate barrel index (scan all existing contract-errors-* folders) ─────
OUTPUT_BASE="$OUTPUT_BASE" \
GENERATED_AT="$GENERATED_AT" \
node << 'BARREL_SCRIPT'
const fs   = require('fs');
const path = require('path');

const base        = process.env.OUTPUT_BASE;
const generatedAt = process.env.GENERATED_AT;

const folders = fs.readdirSync(base)
  .filter(f =>
    f.startsWith('contract-errors-') &&
    fs.statSync(path.join(base, f)).isDirectory()
  )
  .sort();

const lines = [
  `/**`,
  ` * AUTO-GENERATED BARREL – DO NOT EDIT`,
  ` *`,
  ` * Re-exports every generated contract-error enum.`,
  ` * Updated automatically by generate-error-contract-*.bash scripts.`,
  ` * Generated at : ${generatedAt}`,
  ` */`,
  '',
];

for (const folder of folders) {
  lines.push(`export * from './${folder}/index';`);
}
lines.push('');

const barrelPath = path.join(base, 'index.ts');
fs.writeFileSync(barrelPath, lines.join('\n'), 'utf8');
console.log(`\n   ✅ Barrel index → ${barrelPath.replace(/\\/g, '/')}  (${folders.length} contract folder(s))`);
BARREL_SCRIPT

# ── Patch contractErrorsStellarV2.ts (imports + registry + is() overloads) ────
CONTRACTS="${stellar_contracts[*]}" \
STELLAR_V2_FILE="$REPO_ROOT/apps/web-app/src/lib/helpers/contractErrorsStellarV2.ts" \
node << 'PATCH_SCRIPT'
const fs = require('fs');

function toPascalCase(str) {
  return str.split(/[-_]/).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('');
}

function replaceBetweenMarkers(content, beginMarker, endMarker, newInner) {
  const beginIdx = content.indexOf(beginMarker);
  const endIdx   = content.indexOf(endMarker);
  if (beginIdx === -1 || endIdx === -1) {
    throw new Error('Marker not found:\n  BEGIN: "' + beginMarker + '"\n  END:   "' + endMarker + '"');
  }
  const afterBeginLine = content.indexOf('\n', beginIdx) + 1;
  return content.slice(0, afterBeginLine) + newInner + '\n' + endMarker + content.slice(endIdx + endMarker.length);
}

const contracts = process.env.CONTRACTS.split(' ').filter(Boolean);
const v2File    = process.env.STELLAR_V2_FILE;
let content     = fs.readFileSync(v2File, 'utf8');

// ── 1. Imports ────────────────────────────────────────────────────────────────
const importBlock = contracts.map(name => {
  const prefix = toPascalCase(name);
  return `import {\n  ${prefix}Errors,\n  ${prefix}ErrorCode,\n} from "@/lib/constants/generated/contract-errors-stellar-${name}/index";`;
}).join('\n');

content = replaceBetweenMarkers(
  content,
  '// AUTO-GENERATED STELLAR IMPORTS BEGIN - managed by generate-error-contract-stellar-enums.bash',
  '// AUTO-GENERATED STELLAR IMPORTS END',
  importBlock
);

// ── 2. Registry ───────────────────────────────────────────────────────────────
const regEntries = contracts.map(name => {
  const prefix  = toPascalCase(name);
  const padding = ' '.repeat(Math.max(0, 12 - name.length));
  return `  "${name}":${padding}${prefix}Errors as unknown as Record<number, ErrorEntry>,`;
}).join('\n');

const registryBlock =
`/**\n * Stellar: numeric code → ErrorEntry, keyed by contract name.\n * Add new Soroban contracts here as they are generated.\n */\nconst STELLAR_REGISTRY: Record<string, Record<number, ErrorEntry>> = {\n${regEntries}\n};`;

content = replaceBetweenMarkers(
  content,
  '// AUTO-GENERATED STELLAR REGISTRY BEGIN - managed by generate-error-contract-stellar-enums.bash',
  '// AUTO-GENERATED STELLAR REGISTRY END',
  registryBlock
);

// ── 3. is() overloads ─────────────────────────────────────────────────────────
const overloadBlock = contracts.map(name => {
  const prefix = toPascalCase(name);
  return `  /** Check against a Stellar ${name} error code */\n  is(code: ${prefix}ErrorCode): boolean;`;
}).join('\n');

content = replaceBetweenMarkers(
  content,
  '// AUTO-GENERATED STELLAR IS OVERLOADS BEGIN - managed by generate-error-contract-stellar-enums.bash',
  '// AUTO-GENERATED STELLAR IS OVERLOADS END',
  overloadBlock
);

fs.writeFileSync(v2File, content, 'utf8');
console.log('\n   ✅ Patched → ' + v2File.replace(/\\/g, '/'));
PATCH_SCRIPT

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✨ Done – generated files for $found_contracts contract(s)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
