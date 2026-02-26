/**
 * Contract Configuration
 * Centralized contract IDs, network config, and error utilities for Stellar/Soroban.
 *
 * ── Auto-generated enums ─────────────────────────────────────────────────────
 * Re-exports every per-contract enum produced by:
 *   bash apps/web-app/scripts/generate-error-contract-stellar-enums.bash
 *   bash apps/web-app/scripts/generate-error-contract-evm-enum.bash
 *
 * Example usage anywhere in the app:
 *   import { RwaLendingErrorCode, RwaLendingErrors } from '@/lib/constants/contracts';
 *   if (code === RwaLendingErrorCode.PoolFrozen) { ... }
 */

// ── All generated enums (single import point) ─────────────────────────────────
export * from "./generated/index";

// ── Per-contract maps (needed to build the compat API below) ─────────────────
import { RwaLendingErrors } from "./generated/contract-errors-stellar-rwa-lending/index";
import { RwaOracleErrors } from "./generated/contract-errors-stellar-rwa-oracle/index";
import { RwaTokenErrors } from "./generated/contract-errors-stellar-rwa-token/index";
import { RwaPerpsErrors } from "./generated/contract-errors-stellar-rwa-perps/index";

// ── Shared error shape ────────────────────────────────────────────────────────
export interface ContractErrorInfo {
  readonly code: string;
  readonly message: string;
  readonly contract: string;
}

/** Convert a numeric-keyed const map to a plain Record<number, ContractErrorInfo>.
 *  TypeScript numeric enums produce string keys in Object.entries, so we
 *  normalise them back to numbers here. */
function toNumericMap(
  obj: Record<number, ContractErrorInfo>
): Record<number, ContractErrorInfo> {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [Number(k), v])
  );
}

// ── CONTRACT_ERRORS_BY_CONTRACT ───────────────────────────────────────────────
/**
 * Error definitions indexed by contract name, then by numeric error code.
 * Populated entirely from the auto-generated per-contract enum maps.
 */
export const CONTRACT_ERRORS_BY_CONTRACT: Record<
  string,
  Record<number, ContractErrorInfo>
> = {
  "rwa-lending": toNumericMap(
    RwaLendingErrors as unknown as Record<number, ContractErrorInfo>
  ),
  "rwa-oracle": toNumericMap(
    RwaOracleErrors as unknown as Record<number, ContractErrorInfo>
  ),
  "rwa-token": toNumericMap(
    RwaTokenErrors as unknown as Record<number, ContractErrorInfo>
  ),
  "rwa-perps": toNumericMap(
    RwaPerpsErrors as unknown as Record<number, ContractErrorInfo>
  ),
};

// ── CONTRACT_ERRORS (flattened, backward-compatible) ─────────────────────────
/**
 * Flat error map across all contracts.
 * When multiple contracts share the same code, priority order is:
 *   rwa-lending → rwa-token → rwa-oracle → rwa-perps
 */
export const CONTRACT_ERRORS: Record<number, ContractErrorInfo> = (() => {
  const flat: Record<number, ContractErrorInfo> = {};
  for (const name of ["rwa-lending", "rwa-token", "rwa-oracle", "rwa-perps"]) {
    for (const [codeStr, info] of Object.entries(
      CONTRACT_ERRORS_BY_CONTRACT[name]
    )) {
      const code = Number(codeStr);
      if (!(code in flat)) flat[code] = info;
    }
  }
  return flat;
})();

/** Union of all valid numeric error codes across all Stellar contracts */
export type ContractErrorCode = keyof typeof CONTRACT_ERRORS;

/** Error code names across all contracts */
export type ContractErrorName =
  (typeof CONTRACT_ERRORS)[ContractErrorCode]["code"];

/** Contract names that have error definitions */
export type ContractName =
  (typeof CONTRACT_ERRORS)[ContractErrorCode]["contract"];

// ── Lookup helpers ────────────────────────────────────────────────────────────

/** Returns true when `code` is a known error code in the flat map */
export function isValidErrorCode(code: number): code is ContractErrorCode {
  return code in CONTRACT_ERRORS;
}

/** Returns the error info for a specific contract + code, or null */
export function getContractError(
  contractName: string,
  errorCode: number
): ContractErrorInfo | null {
  return CONTRACT_ERRORS_BY_CONTRACT[contractName]?.[errorCode] ?? null;
}

/** Returns all error entries for a specific contract */
export function getErrorsForContract(
  contractName: string
): ContractErrorInfo[] {
  return Object.values(CONTRACT_ERRORS_BY_CONTRACT[contractName] ?? {});
}

/** Returns true when `code` is valid for the given contract */
export function isValidContractErrorCode(
  contractName: string,
  code: number
): boolean {
  return code in (CONTRACT_ERRORS_BY_CONTRACT[contractName] ?? {});
}

// ── Contract IDs ──────────────────────────────────────────────────────────────
export const LENDING_CONTRACT_ID =
  "CD5WNBT4NEYYLALY776KRRR2WP7BEM4VJPG6QYQE5CRO6C5H4YUQA5KS";
