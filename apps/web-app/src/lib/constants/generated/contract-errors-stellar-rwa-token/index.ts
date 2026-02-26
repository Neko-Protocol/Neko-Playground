/**
 * AUTO-GENERATED FILE – DO NOT EDIT
 *
 * Generated from : apps/contracts/stellar-contracts/rwa-token/src/common/error.rs
 * Run            : bash apps/web-app/scripts/generate-error-contract-stellar-enums.bash
 * Generated at   : 2026-02-26T07:22:37Z
 */

export interface RwaTokenErrorEntry {
  readonly code: string;
  readonly message: string;
  readonly contract: string;
}

/** Numeric error codes for the rwa-token Soroban contract */
export enum RwaTokenErrorCode {
  InsufficientBalance = 1,
  InvalidLedgerSequence = 2,
  OraclePriceFetchFailed = 3,
  OracleDecimalsFetchFailed = 4,
  ValueNotPositive = 5,
  InsufficientAllowance = 6,
  ArithmeticError = 7,
  CannotTransferToSelf = 8,
  AddressFrozen = 9,
  ComplianceCheckFailed = 10,
  MetadataNotFound = 11,
  NotInitialized = 12,
  AlreadyInitialized = 13,
}

/** Full error info keyed by numeric code – property order: code → message → contract */
export const RwaTokenErrors: {
  readonly [K in RwaTokenErrorCode]: RwaTokenErrorEntry;
} = {
  [RwaTokenErrorCode.InsufficientBalance]: {
    code: "InsufficientBalance",
    message: "Insufficient balance",
    contract: "rwa-token",
  },
  [RwaTokenErrorCode.InvalidLedgerSequence]: {
    code: "InvalidLedgerSequence",
    message:
      "live_until_ledger must be greater than or equal to the current ledger number",
    contract: "rwa-token",
  },
  [RwaTokenErrorCode.OraclePriceFetchFailed]: {
    code: "OraclePriceFetchFailed",
    message: "Failed to fetch price data from the Oracle",
    contract: "rwa-token",
  },
  [RwaTokenErrorCode.OracleDecimalsFetchFailed]: {
    code: "OracleDecimalsFetchFailed",
    message: "Failed to fetch decimals from the Oracle",
    contract: "rwa-token",
  },
  [RwaTokenErrorCode.ValueNotPositive]: {
    code: "ValueNotPositive",
    message: "Value must be greater than or equal to 0",
    contract: "rwa-token",
  },
  [RwaTokenErrorCode.InsufficientAllowance]: {
    code: "InsufficientAllowance",
    message: "Insufficient allowance; spender must call `approve` first",
    contract: "rwa-token",
  },
  [RwaTokenErrorCode.ArithmeticError]: {
    code: "ArithmeticError",
    message: "Arithmetic overflow or underflow occurred",
    contract: "rwa-token",
  },
  [RwaTokenErrorCode.CannotTransferToSelf]: {
    code: "CannotTransferToSelf",
    message: "Cannot transfer to self",
    contract: "rwa-token",
  },
  [RwaTokenErrorCode.AddressFrozen]: {
    code: "AddressFrozen",
    message: "Address is frozen (not authorized for transfers)",
    contract: "rwa-token",
  },
  [RwaTokenErrorCode.ComplianceCheckFailed]: {
    code: "ComplianceCheckFailed",
    message:
      "Compliance check failed (SEP-57 compliance contract rejected transfer)",
    contract: "rwa-token",
  },
  [RwaTokenErrorCode.MetadataNotFound]: {
    code: "MetadataNotFound",
    message: "Metadata not found in RWA Oracle",
    contract: "rwa-token",
  },
  [RwaTokenErrorCode.NotInitialized]: {
    code: "NotInitialized",
    message: "Contract is not initialized",
    contract: "rwa-token",
  },
  [RwaTokenErrorCode.AlreadyInitialized]: {
    code: "AlreadyInitialized",
    message: "Contract is already initialized",
    contract: "rwa-token",
  },
} as const;

/** Union of all error names defined in rwa-token */
export type RwaTokenErrorName = keyof typeof RwaTokenErrors;
