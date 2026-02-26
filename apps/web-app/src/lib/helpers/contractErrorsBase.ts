/**
 * contractErrorsBase – Shared primitives for Stellar and EVM contract error helpers.
 *
 * Consumed by:
 *   - contractErrorsStellarV2.ts  (StellarContractError)
 *   - contractErrorsEvmV2.ts      (EvmContractError)
 */

// ── Shared entry shape ────────────────────────────────────────────────────────
export interface ErrorEntry {
  readonly code: string;
  readonly message: string;
  readonly contract: string;
}

// ── Resolved payload ──────────────────────────────────────────────────────────
export interface ResolvedError {
  /** The error name / code string, e.g. "PoolFrozen" */
  code: string;
  /** Alias for code */
  name: string;
  /** Human-readable message */
  message: string;
  /** The contract that owns this error */
  contract: string;
  /** Numeric code (Stellar only, otherwise null) */
  numericCode: number | null;
}

// ── Cancellation patterns ─────────────────────────────────────────────────────
export const CANCELLATION_PATTERNS = [
  "user rejected",
  "user denied",
  "user declined",
  "cancelled",
  "canceled",
  "action_cancelled",
  "request rejected",
  "transaction rejected",
  "signature rejected",
  "4001",
] as const;

// ── Normalise any thrown value to a plain string ──────────────────────────────
export function toErrorString(error: unknown): string {
  if (!error) return "";
  if (typeof error !== "object") return String(error);
  const obj = error as Record<string, unknown>;
  if (typeof obj.message === "string") return obj.message;
  if (obj.name && obj.message) return `${obj.name}: ${obj.message}`;
  try {
    const s = JSON.stringify(error);
    return s === "{}" || s === '{""}' ? "" : s;
  } catch {
    return "";
  }
}

// ── Shared result builder ─────────────────────────────────────────────────────
export function toResolved(
  entry: ErrorEntry,
  numericCode: number | null
): ResolvedError {
  return {
    code: entry.code,
    name: entry.code,
    message: entry.message,
    contract: entry.contract,
    numericCode,
  };
}
