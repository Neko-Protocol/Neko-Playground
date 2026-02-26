/**
 * EvmContractError – Builder API for EVM/Solidity contract errors.
 *
 * Wraps any thrown value and resolves it against the auto-generated per-contract
 * EVM enum dictionaries (revert name format).
 *
 * Usage:
 *   new EvmContractError(err, "evm-rwa-lending").code()    // "InsufficientCollateral"
 *   new EvmContractError(err, "evm-rwa-lending").message() // "Insufficient Collateral"
 *   new EvmContractError(err).isKnown()                    // true | false
 *   new EvmContractError(err).isCancellation()             // true | false
 *
 * Stellar errors → use StellarContractError (contractErrorsStellarV2.ts).
 */

// ── Shared primitives ─────────────────────────────────────────────────────────
import {
  type ErrorEntry,
  type ResolvedError,
  CANCELLATION_PATTERNS,
  toErrorString,
  toResolved,
} from "./contractErrorsBase";

// ── EVM dictionaries ──────────────────────────────────────────────────────────
// AUTO-GENERATED EVM IMPORTS BEGIN - managed by generate-error-contract-evm-enum.bash
import { EvmRwaLendingErrors } from "@/lib/constants/generated/contract-errors-evm-rwa-lending/index";
// AUTO-GENERATED EVM IMPORTS END

// ── Registry ──────────────────────────────────────────────────────────────────

// AUTO-GENERATED EVM REGISTRY BEGIN - managed by generate-error-contract-evm-enum.bash
/**
 * EVM: error name string → ErrorEntry, keyed by contract id.
 * Add new EVM contracts here as they are generated.
 */
const EVM_REGISTRY: Record<string, Record<string, ErrorEntry>> = {
  "evm-rwa-lending": EvmRwaLendingErrors as unknown as Record<
    string,
    ErrorEntry
  >,
};
// AUTO-GENERATED EVM REGISTRY END

// ── EVM-specific parsers ──────────────────────────────────────────────────────

/**
 * Extracts the error name from a viem/ethers revert error.
 * viem surfaces `errorName` directly on the thrown object;
 * ethers v6 surfaces it in the `revert.name` or message string.
 */
function parseEvmName(error: unknown, errorString: string): string | null {
  // viem surfaces errorName directly on the thrown object
  const obj = error as Record<string, unknown>;
  if (typeof obj.errorName === "string") return obj.errorName;

  const patterns = [
    /errorName['":\s]+['"]?(\w+)['"]?/i,
    /execution reverted[:\s]+(\w+)/i,
    /custom error\s+['"](\w+)\(/i,
    /^(?:Error:\s*)?(\w+)\(\)/,
    /(?:^|[:\s])([A-Z]\w+)$/,
  ];
  for (const re of patterns) {
    const m = errorString.match(re);
    if (m?.[1] && /^[A-Z]/.test(m[1])) return m[1];
  }
  return null;
}

// ── EVM resolution ────────────────────────────────────────────────────────────

function resolveEvm(
  error: unknown,
  errorString: string,
  contractId?: string
): ResolvedError | null {
  const evmName = parseEvmName(error, errorString);
  // No recognisable EVM error name found — skip this path entirely
  if (!evmName) return null;

  // 1. Contract-specific lookup when a contractId is provided
  const specificEntry = contractId
    ? EVM_REGISTRY[contractId]?.[evmName]
    : undefined;
  if (specificEntry) return toResolved(specificEntry, null);

  // 2. Scan all EVM contracts when no contractId was supplied
  for (const map of Object.values(EVM_REGISTRY)) {
    const fallbackEntry = map[evmName];
    if (fallbackEntry) return toResolved(fallbackEntry, null);
  }

  // 3. Name is parseable but not in any registry — split CamelCase as fallback message
  const readable = evmName.replace(/([a-z\d])([A-Z])/g, "$1 $2").trim();
  return {
    code: evmName,
    name: evmName,
    message: readable,
    contract: contractId ?? "unknown",
    numericCode: null,
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// EvmContractError – Builder class
// ═════════════════════════════════════════════════════════════════════════════

export class EvmContractError {
  private readonly _errorString: string;
  private readonly _contractId: string | undefined;
  private readonly _resolved: ResolvedError | null;

  /**
   * @param error      - Any value thrown by an EVM contract call.
   * @param contractId - Optional contract id to narrow the lookup.
   *                     e.g. `"evm-rwa-lending"`
   */
  constructor(error: unknown, contractId?: string) {
    this._contractId = contractId;
    this._errorString = toErrorString(error);
    this._resolved = resolveEvm(error, this._errorString, contractId);
  }

  // ── Resolved fields ───────────────────────────────────────────────────────

  /**
   * The error name string, e.g. `"InsufficientCollateral"`.
   * Returns the raw error string when unresolved.
   */
  code(): string {
    return this._resolved?.code ?? this._errorString;
  }

  /** Alias for `.code()`. */
  name(): string {
    return this._resolved?.name ?? this._errorString;
  }

  /**
   * Human-readable message from the dictionary.
   * Falls back to a CamelCase-split version of the error name, or a generic message.
   */
  message(): string {
    if (this._resolved) return this._resolved.message;
    if (this.isCancellation()) return "Transaction was cancelled by user";

    const cleaned = this._errorString
      .replace(/Error:/gi, "")
      .replace(/\s+/g, " ")
      .trim();

    if (
      !cleaned ||
      cleaned.length > 150 ||
      cleaned.includes("0x") ||
      cleaned.includes("[object")
    ) {
      return "Transaction failed. Please try again or contact support.";
    }
    return cleaned;
  }

  /**
   * The contract id that owns this error, e.g. `"evm-rwa-lending"`.
   * Returns `null` when unresolved.
   */
  contract(): string | null {
    return this._resolved?.contract ?? null;
  }

  // ── Boolean guards ────────────────────────────────────────────────────────

  /** True when the error was successfully resolved against an EVM dictionary. */
  isKnown(): boolean {
    return this._resolved !== null;
  }

  /** True when the user deliberately rejected / cancelled the transaction. */
  isCancellation(): boolean {
    const lower = this._errorString.toLowerCase();
    return CANCELLATION_PATTERNS.some((p) => lower.includes(p));
  }

  /**
   * Returns `null` on user cancellation, otherwise `.message()`.
   * Handy for notification systems that should stay silent on rejection.
   */
  messageOrNull(): string | null {
    return this.isCancellation() ? null : this.message();
  }

  // ── Serialisation ─────────────────────────────────────────────────────────

  /** Snapshot of all resolved fields as a plain object. */
  toJSON(): {
    code: string;
    name: string;
    message: string;
    contract: string | null;
    isKnown: boolean;
    isCancellation: boolean;
  } {
    return {
      code: this.code(),
      name: this.name(),
      message: this.message(),
      contract: this.contract(),
      isKnown: this.isKnown(),
      isCancellation: this.isCancellation(),
    };
  }

  toString(): string {
    return this.message();
  }
}
