#!/usr/bin/env bash
# =============================================================================
# generate-error-contract-evm-enum.bash
#
# Generates TypeScript enum files from EVM (Solidity) contract error
# definitions. Auto-discovers all contracts under:
#   apps/contracts/evm-contracts/{contract-name}/
#
# Expected architecture per contract:
#   src/libraries/Errors.sol  ← must contain a  library Errors { ... }  block
#
# Output (one folder per contract):
#   apps/web-app/src/lib/constants/generated/contract-errors-evm-{name}/index.ts
#
# Exits with a non-zero status and a descriptive error message if any contract
# directory does not follow the expected architecture.
#
# Note on codes: Solidity custom errors carry no numeric code at the language
# level (they are identified by their 4-byte selector). A sequential index
# starting from 0 is assigned in declaration order and stored as `code` in the
# generated TypeScript for a consistent interface shape with Stellar errors.
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
EVM_DIR="$REPO_ROOT/apps/contracts/evm-contracts"
OUTPUT_BASE="$REPO_ROOT/apps/web-app/src/lib/constants/generated"
GENERATED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

# ── Validate root directory ───────────────────────────────────────────────────
if [[ ! -d "$EVM_DIR" ]]; then
  echo "❌ ERROR: EVM contracts directory not found." >&2
  echo "   Expected: $EVM_DIR" >&2
  exit 1
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  EVM Contract Error Enum Generator"
echo "  Source : $EVM_DIR"
echo "  Output : $OUTPUT_BASE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

evm_contracts=()
found_contracts=0

for contract_dir in "$EVM_DIR"/*/; do
  [[ -d "$contract_dir" ]] || continue

  contract_name="$(basename "$contract_dir")"

  echo ""
  echo "📦 Contract: $contract_name"

  errors_file="$contract_dir/src/libraries/Errors.sol"

  # ── Architecture validation ───────────────────────────────────────────────────
  if [[ ! -f "$errors_file" ]]; then
    echo "❌ ERROR: Architecture mismatch for EVM contract '$contract_name'" >&2
    echo "   Expected : src/libraries/Errors.sol" >&2
    echo "   Not found: $errors_file" >&2
    echo "" >&2
    echo "   → Every EVM contract must define its custom errors in src/libraries/Errors.sol" >&2
    exit 1
  fi

  if ! grep -q 'library Errors' "$errors_file"; then
    echo "❌ ERROR: '$errors_file' does not contain a 'library Errors' declaration" >&2
    echo "   → Custom errors must be declared inside a Solidity library named 'Errors'" >&2
    exit 1
  fi

  out_dir="$OUTPUT_BASE/contract-errors-evm-$contract_name"
  mkdir -p "$out_dir"
  out_file="$out_dir/index.ts"

  # ── Parse & generate via Node.js (heredoc, no shell-variable expansion inside) ─
  CONTRACT_NAME="$contract_name" \
  ERRORS_FILE="$errors_file" \
  OUT_FILE="$out_file" \
  GENERATED_AT="$GENERATED_AT" \
  RELATIVE_SOURCE="apps/contracts/evm-contracts/$contract_name/src/libraries/Errors.sol" \
  node << 'NODE_SCRIPT'
const fs = require('fs');

const contractName   = process.env.CONTRACT_NAME;
const errorsFile     = process.env.ERRORS_FILE;
const outFile        = process.env.OUT_FILE;
const generatedAt    = process.env.GENERATED_AT;
const relativeSource = process.env.RELATIVE_SOURCE;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Split PascalCase / CamelCase into space-separated words.
 *  "ZeroAddress"          → "Zero Address"
 *  "LTVExceedsThreshold"  → "LTV Exceeds Threshold"  */
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

// ── Parse Solidity  library Errors { ... }  block ────────────────────────────
const content = fs.readFileSync(errorsFile, 'utf8');
const lines   = content.split('\n');

let inLibrary  = false;
let braceDepth = 0;
let errorIndex = 0;      // sequential index (Solidity has no numeric error codes)
const entries  = [];     // { name: string, code: number, message: string }

for (const rawLine of lines) {
  const line = rawLine.trim();

  // ── Find the opening of library Errors ───────────────────────────────────────
  if (!inLibrary) {
    if (/library\s+Errors\s*\{/.test(line)) {
      inLibrary  = true;
      braceDepth = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
    }
    continue;
  }

  // ── Track brace depth; exit when the library block closes ────────────────────
  const opens  = (line.match(/\{/g) || []).length;
  const closes = (line.match(/\}/g) || []).length;
  braceDepth  += opens - closes;
  if (braceDepth <= 0) break;

  // ── Custom error declaration: error Name();  or  error Name(type arg, ...); ──
  const m = line.match(/^error\s+(\w+)\s*\(.*\)\s*;/);
  if (m) {
    const name    = m[1];
    const message = splitCamelCase(name);
    entries.push({ name, code: errorIndex, message });
    errorIndex++;
  }
}

if (entries.length === 0) {
  process.stderr.write(
    `❌ ERROR: No custom errors parsed from ${errorsFile}\n` +
    `   → Verify the file contains a well-formed 'library Errors { ... }' block\n`
  );
  process.exit(1);
}

// ── Build TypeScript source ───────────────────────────────────────────────────
const fullContractId = `evm-${contractName}`;
const prefix         = toPascalCase(fullContractId);  // "evm-rwa-lending" → "EvmRwaLending"
const enumName       = `${prefix}ErrorCode`;           // EvmRwaLendingErrorCode
const constName      = `${prefix}Errors`;              // EvmRwaLendingErrors
const entryType      = `${prefix}ErrorEntry`;          // EvmRwaLendingErrorEntry

// String enum: Solidity errors are identified by name (4-byte selector hash),
// not by a numeric code, so string values give the most meaningful comparison.
const enumBody = entries
  .map(e => `  ${e.name} = "${e.name}",`)
  .join('\n');

const constBody = entries
  .map(e =>
    `  [${enumName}.${e.name}]: {\n` +
    `    code: "${e.name}",\n` +
    `    message: "${e.message.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}",\n` +
    `    contract: "${fullContractId}",\n` +
    `  },`
  )
  .join('\n');

const ts =
`/**
 * AUTO-GENERATED FILE – DO NOT EDIT
 *
 * Generated from : ${relativeSource}
 * Run            : bash apps/web-app/scripts/generate-error-contract-evm-enum.bash
 * Generated at   : ${generatedAt}
 *
 * Note: Solidity custom errors carry no numeric code at the language level
 * (they are identified by their 4-byte selector). The enum uses string values
 * for type-safe comparisons; \`code\` mirrors the error name string.
 */

export interface ${entryType} {
  readonly code: string;
  readonly message: string;
  readonly contract: string;
}

/** String-valued enum for all custom errors in the EVM ${contractName} contract */
export enum ${enumName} {
${enumBody}
}

/** Full error info keyed by error name – property order: code → message → contract */
export const ${constName}: { readonly [K in ${enumName}]: ${entryType} } = {
${constBody}
} as const;

/** Union of all error names defined in ${fullContractId} */
export type ${prefix}ErrorName = keyof typeof ${constName};
`;

fs.writeFileSync(outFile, ts, 'utf8');
console.log(`   ✅ Written → ${outFile.replace(/\\/g, '/')}  (${entries.length} errors)`);
NODE_SCRIPT

  found_contracts=$((found_contracts + 1))
  evm_contracts+=("$contract_name")
done

echo ""
if [[ $found_contracts -eq 0 ]]; then
  echo "❌ ERROR: No EVM contract directories found in $EVM_DIR" >&2
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

# ── Patch contractErrorsEvmV2.ts (imports + registry) ─────────────────────────
CONTRACTS="${evm_contracts[*]}" \
EVM_V2_FILE="$REPO_ROOT/apps/web-app/src/lib/helpers/contractErrorsEvmV2.ts" \
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
const v2File    = process.env.EVM_V2_FILE;
let content     = fs.readFileSync(v2File, 'utf8');

// ── 1. Imports ────────────────────────────────────────────────────────────────
const importBlock = contracts.map(name => {
  const fullId = `evm-${name}`;
  const prefix = toPascalCase(fullId);
  return `import { ${prefix}Errors } from "@/lib/constants/generated/contract-errors-evm-${name}/index";`;
}).join('\n');

content = replaceBetweenMarkers(
  content,
  '// AUTO-GENERATED EVM IMPORTS BEGIN - managed by generate-error-contract-evm-enum.bash',
  '// AUTO-GENERATED EVM IMPORTS END',
  importBlock
);

// ── 2. Registry ───────────────────────────────────────────────────────────────
const regEntries = contracts.map(name => {
  const fullId  = `evm-${name}`;
  const prefix  = toPascalCase(fullId);
  const padding = ' '.repeat(Math.max(0, 16 - fullId.length));
  return `  "${fullId}":${padding}${prefix}Errors as unknown as Record<string, ErrorEntry>,`;
}).join('\n');

const registryBlock =
`/**\n * EVM: error name string → ErrorEntry, keyed by contract id.\n * Add new EVM contracts here as they are generated.\n */\nconst EVM_REGISTRY: Record<string, Record<string, ErrorEntry>> = {\n${regEntries}\n};`;

content = replaceBetweenMarkers(
  content,
  '// AUTO-GENERATED EVM REGISTRY BEGIN - managed by generate-error-contract-evm-enum.bash',
  '// AUTO-GENERATED EVM REGISTRY END',
  registryBlock
);

fs.writeFileSync(v2File, content, 'utf8');
console.log('\n   ✅ Patched → ' + v2File.replace(/\\/g, '/'));
PATCH_SCRIPT

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✨ Done – generated files for $found_contracts contract(s)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
