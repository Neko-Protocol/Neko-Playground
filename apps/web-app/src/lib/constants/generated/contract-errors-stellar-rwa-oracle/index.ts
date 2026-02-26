/**
 * AUTO-GENERATED FILE – DO NOT EDIT
 *
 * Generated from : apps/contracts/stellar-contracts/rwa-oracle/src/common/error.rs
 * Run            : bash apps/web-app/scripts/generate-error-contract-stellar-enums.bash
 * Generated at   : 2026-02-26T07:22:37Z
 */

export interface RwaOracleErrorEntry {
  readonly code: string;
  readonly message: string;
  readonly contract: string;
}

/** Numeric error codes for the rwa-oracle Soroban contract */
export enum RwaOracleErrorCode {
  AssetNotFound = 1,
  AssetAlreadyExists = 2,
  InvalidRWAType = 3,
  InvalidMetadata = 4,
  InvalidPrice = 5,
  Unauthorized = 6,
  TimestampInFuture = 7,
  TimestampTooOld = 8,
}

/** Full error info keyed by numeric code – property order: code → message → contract */
export const RwaOracleErrors: {
  readonly [K in RwaOracleErrorCode]: RwaOracleErrorEntry;
} = {
  [RwaOracleErrorCode.AssetNotFound]: {
    code: "AssetNotFound",
    message: "Asset not found",
    contract: "rwa-oracle",
  },
  [RwaOracleErrorCode.AssetAlreadyExists]: {
    code: "AssetAlreadyExists",
    message: "Asset already exists",
    contract: "rwa-oracle",
  },
  [RwaOracleErrorCode.InvalidRWAType]: {
    code: "InvalidRWAType",
    message: "Invalid RWA type",
    contract: "rwa-oracle",
  },
  [RwaOracleErrorCode.InvalidMetadata]: {
    code: "InvalidMetadata",
    message: "Invalid metadata",
    contract: "rwa-oracle",
  },
  [RwaOracleErrorCode.InvalidPrice]: {
    code: "InvalidPrice",
    message: "Invalid price (zero or negative)",
    contract: "rwa-oracle",
  },
  [RwaOracleErrorCode.Unauthorized]: {
    code: "Unauthorized",
    message: "Unauthorized access",
    contract: "rwa-oracle",
  },
  [RwaOracleErrorCode.TimestampInFuture]: {
    code: "TimestampInFuture",
    message: "Timestamp is too far in the future",
    contract: "rwa-oracle",
  },
  [RwaOracleErrorCode.TimestampTooOld]: {
    code: "TimestampTooOld",
    message: "Timestamp is too old or not strictly increasing",
    contract: "rwa-oracle",
  },
} as const;

/** Union of all error names defined in rwa-oracle */
export type RwaOracleErrorName = keyof typeof RwaOracleErrors;
