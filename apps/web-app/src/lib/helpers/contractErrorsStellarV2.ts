/**
 * StellarContractError – Builder API for Soroban/Stellar contract errors.
 *
 * Wraps any thrown value and resolves it against the auto-generated per-contract
 * Stellar enum dictionaries (numeric Error(Contract, #N) format).
 *
 * Usage:
 *   new StellarContractError(err, "rwa-lending").code()        // "PoolFrozen"
 *   new StellarContractError(err, "rwa-lending").numericCode() // 10
 *   new StellarContractError(err).isCancellation()             // true | false
 *   new StellarContractError(err).is(RwaLendingErrorCode.PoolFrozen) // true
 *
 * EVM errors → use EvmContractError (contractErrorsEvmV2.ts).
 */

// ── Shared primitives ─────────────────────────────────────────────────────────
import {
  type ErrorEntry,
  type ResolvedError,
  CANCELLATION_PATTERNS,
  toErrorString,
  toResolved,
} from "./contractErrorsBase";

// ── Stellar dictionaries ──────────────────────────────────────────────────────
// AUTO-GENERATED STELLAR IMPORTS BEGIN - managed by generate-error-contract-stellar-enums.bash
import {
  RwaLendingErrors,
  RwaLendingErrorCode,
} from "@/lib/constants/generated/contract-errors-stellar-rwa-lending/index";
import {
  RwaOracleErrors,
  RwaOracleErrorCode,
} from "@/lib/constants/generated/contract-errors-stellar-rwa-oracle/index";
import {
  RwaPerpsErrors,
  RwaPerpsErrorCode,
} from "@/lib/constants/generated/contract-errors-stellar-rwa-perps/index";
import {
  RwaTokenErrors,
  RwaTokenErrorCode,
} from "@/lib/constants/generated/contract-errors-stellar-rwa-token/index";
// AUTO-GENERATED STELLAR IMPORTS END

// ── Registry ──────────────────────────────────────────────────────────────────

// AUTO-GENERATED STELLAR REGISTRY BEGIN - managed by generate-error-contract-stellar-enums.bash
/**
 * Stellar: numeric code → ErrorEntry, keyed by contract name.
 * Add new Soroban contracts here as they are generated.
 */
const STELLAR_REGISTRY: Record<string, Record<number, ErrorEntry>> = {
  "rwa-lending": RwaLendingErrors as unknown as Record<number, ErrorEntry>,
  "rwa-oracle": RwaOracleErrors as unknown as Record<number, ErrorEntry>,
  "rwa-perps": RwaPerpsErrors as unknown as Record<number, ErrorEntry>,
  "rwa-token": RwaTokenErrors as unknown as Record<number, ErrorEntry>,
};
// AUTO-GENERATED STELLAR REGISTRY END

// ── Stellar-specific parsers ──────────────────────────────────────────────────

/** Extracts the numeric code from `Error(Contract, #N)` format. Returns null if not Stellar. */
function parseStellarCode(errorString: string): number | null {
  const m = errorString.match(/Error\(Contract,\s*#(\d+)\)/);
  return m ? parseInt(m[1], 10) : null;
}

/** Infers the contract name from keywords in the error string. */
function inferStellarContract(errorString: string): string | null {
  const patterns: [RegExp, string][] = [
    [/rwa-lending/i, "rwa-lending"],
    [/rwa-token/i, "rwa-token"],
    [/rwa-oracle/i, "rwa-oracle"],
    [/rwa-perps/i, "rwa-perps"],
    [/lending/i, "rwa-lending"],
    [/token/i, "rwa-token"],
    [/oracle/i, "rwa-oracle"],
    [/perps|perpetual/i, "rwa-perps"],
  ];
  for (const [re, name] of patterns) {
    if (re.test(errorString)) return name;
  }
  return null;
}

// ── Stellar resolution ────────────────────────────────────────────────────────

function resolveStellar(
  errorString: string,
  contractId?: string
): ResolvedError | null {
  const numericCode = parseStellarCode(errorString);
  // Not a Stellar error format — skip this path entirely
  if (numericCode === null) return null;

  // 1. Contract-specific lookup: supplied contractId first, then inferred from string
  const contract = contractId ?? inferStellarContract(errorString);
  const specificEntry = contract
    ? STELLAR_REGISTRY[contract]?.[numericCode]
    : undefined;
  if (specificEntry) return toResolved(specificEntry, numericCode);

  // 2. Flat-map fallback across all Stellar contracts in priority order
  const PRIORITY = [
    "rwa-lending",
    "rwa-token",
    "rwa-oracle",
    "rwa-perps",
  ] as const;
  for (const name of PRIORITY) {
    const fallbackEntry = STELLAR_REGISTRY[name]?.[numericCode];
    if (fallbackEntry) return toResolved(fallbackEntry, numericCode);
  }

  // 3. Code is recognised as Stellar format but unknown — return a bare stub
  return {
    code: String(numericCode),
    name: String(numericCode),
    message: `Contract error #${numericCode}`,
    contract: contractId ?? "unknown",
    numericCode,
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// StellarContractError – Builder class
// ═════════════════════════════════════════════════════════════════════════════

export class StellarContractError {
  private readonly _errorString: string;
  private readonly _contractId: string | undefined;
  private readonly _resolved: ResolvedError | null;

  /**
   * @param error      - Any value thrown by a Soroban contract call.
   * @param contractId - Optional contract name to narrow the lookup.
   *                     One of: `"rwa-lending"` | `"rwa-oracle"` | `"rwa-token"` | `"rwa-perps"`
   */
  constructor(error: unknown, contractId?: string) {
    this._contractId = contractId;
    this._errorString = toErrorString(error);
    this._resolved = resolveStellar(this._errorString, contractId);
  }

  // ── Resolved fields ───────────────────────────────────────────────────────

  /**
   * The error name string, e.g. `"PoolFrozen"`.
   * Returns the raw numeric code as string when unresolved.
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
   * Falls back to a sanitised raw error string when unresolved.
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
      cleaned.includes("wasm") ||
      cleaned.includes("[object")
    ) {
      return "Transaction failed. Please try again or contact support.";
    }
    return cleaned;
  }

  /**
   * The contract name that owns this error, e.g. `"rwa-lending"`.
   * Returns `null` when unresolved.
   */
  contract(): string | null {
    return this._resolved?.contract ?? null;
  }

  /** The raw numeric Stellar error code. Returns `null` when unresolved. */
  numericCode(): number | null {
    return this._resolved?.numericCode ?? null;
  }

  // ── Boolean guards ────────────────────────────────────────────────────────

  /** True when the error was successfully resolved against a Stellar dictionary. */
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

  // ── Type-safe enum checks ─────────────────────────────────────────────────

  // AUTO-GENERATED STELLAR IS OVERLOADS BEGIN - managed by generate-error-contract-stellar-enums.bash
  /** Check against a Stellar rwa-lending error code */
  is(code: RwaLendingErrorCode): boolean;
  /** Check against a Stellar rwa-oracle error code */
  is(code: RwaOracleErrorCode): boolean;
  /** Check against a Stellar rwa-perps error code */
  is(code: RwaPerpsErrorCode): boolean;
  /** Check against a Stellar rwa-token error code */
  is(code: RwaTokenErrorCode): boolean;
  // AUTO-GENERATED STELLAR IS OVERLOADS END
  /** Overload signature */
  is(code: number): boolean;
  is(code: number): boolean {
    return this._resolved?.numericCode === code;
  }

  // ── Serialisation ─────────────────────────────────────────────────────────

  /** Snapshot of all resolved fields as a plain object. */
  toJSON(): {
    code: string;
    name: string;
    message: string;
    contract: string | null;
    numericCode: number | null;
    isKnown: boolean;
    isCancellation: boolean;
  } {
    return {
      code: this.code(),
      name: this.name(),
      message: this.message(),
      contract: this.contract(),
      numericCode: this.numericCode(),
      isKnown: this.isKnown(),
      isCancellation: this.isCancellation(),
    };
  }

  toString(): string {
    return this.message();
  }
}
