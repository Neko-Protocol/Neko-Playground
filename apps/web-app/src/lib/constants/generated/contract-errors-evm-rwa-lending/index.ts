/**
 * AUTO-GENERATED FILE – DO NOT EDIT
 *
 * Generated from : apps/contracts/evm-contracts/rwa-lending/src/libraries/Errors.sol
 * Run            : bash apps/web-app/scripts/generate-error-contract-evm-enum.bash
 * Generated at   : 2026-02-26T07:22:41Z
 *
 * Note: Solidity custom errors carry no numeric code at the language level
 * (they are identified by their 4-byte selector). The enum uses string values
 * for type-safe comparisons; `code` mirrors the error name string.
 */

export interface EvmRwaLendingErrorEntry {
  readonly code: string;
  readonly message: string;
  readonly contract: string;
}

/** String-valued enum for all custom errors in the EVM rwa-lending contract */
export enum EvmRwaLendingErrorCode {
  ZeroAddress = "ZeroAddress",
  ZeroAmount = "ZeroAmount",
  InvalidAmount = "InvalidAmount",
  InvalidInput = "InvalidInput",
  Unauthorized = "Unauthorized",
  Paused = "Paused",
  CollateralNotActive = "CollateralNotActive",
  CollateralFrozen = "CollateralFrozen",
  CollateralNotEnabled = "CollateralNotEnabled",
  InsufficientCollateral = "InsufficientCollateral",
  CollateralAlreadyExists = "CollateralAlreadyExists",
  CollateralNotSupported = "CollateralNotSupported",
  BorrowNotActive = "BorrowNotActive",
  BorrowFrozen = "BorrowFrozen",
  InsufficientBorrowCapacity = "InsufficientBorrowCapacity",
  InsufficientLiquidity = "InsufficientLiquidity",
  BorrowAssetNotSupported = "BorrowAssetNotSupported",
  NoBorrowPosition = "NoBorrowPosition",
  PositionHealthy = "PositionHealthy",
  InvalidLiquidationAmount = "InvalidLiquidationAmount",
  LiquidationNotProfitable = "LiquidationNotProfitable",
  InvalidInterestRate = "InvalidInterestRate",
  InterestAccrualFailed = "InterestAccrualFailed",
  InvalidPrice = "InvalidPrice",
  StalePrice = "StalePrice",
  OracleNotSet = "OracleNotSet",
  TransferFailed = "TransferFailed",
  ApprovalFailed = "ApprovalFailed",
  InsufficientBalance = "InsufficientBalance",
  DebtTokenNotTransferable = "DebtTokenNotTransferable",
  InvalidLTV = "InvalidLTV",
  InvalidLiquidationThreshold = "InvalidLiquidationThreshold",
  InvalidLiquidationBonus = "InvalidLiquidationBonus",
  LTVExceedsLiquidationThreshold = "LTVExceedsLiquidationThreshold",
}

/** Full error info keyed by error name – property order: code → message → contract */
export const EvmRwaLendingErrors: {
  readonly [K in EvmRwaLendingErrorCode]: EvmRwaLendingErrorEntry;
} = {
  [EvmRwaLendingErrorCode.ZeroAddress]: {
    code: "ZeroAddress",
    message: "Zero Address",
    contract: "evm-rwa-lending",
  },
  [EvmRwaLendingErrorCode.ZeroAmount]: {
    code: "ZeroAmount",
    message: "Zero Amount",
    contract: "evm-rwa-lending",
  },
  [EvmRwaLendingErrorCode.InvalidAmount]: {
    code: "InvalidAmount",
    message: "Invalid Amount",
    contract: "evm-rwa-lending",
  },
  [EvmRwaLendingErrorCode.InvalidInput]: {
    code: "InvalidInput",
    message: "Invalid Input",
    contract: "evm-rwa-lending",
  },
  [EvmRwaLendingErrorCode.Unauthorized]: {
    code: "Unauthorized",
    message: "Unauthorized",
    contract: "evm-rwa-lending",
  },
  [EvmRwaLendingErrorCode.Paused]: {
    code: "Paused",
    message: "Paused",
    contract: "evm-rwa-lending",
  },
  [EvmRwaLendingErrorCode.CollateralNotActive]: {
    code: "CollateralNotActive",
    message: "Collateral Not Active",
    contract: "evm-rwa-lending",
  },
  [EvmRwaLendingErrorCode.CollateralFrozen]: {
    code: "CollateralFrozen",
    message: "Collateral Frozen",
    contract: "evm-rwa-lending",
  },
  [EvmRwaLendingErrorCode.CollateralNotEnabled]: {
    code: "CollateralNotEnabled",
    message: "Collateral Not Enabled",
    contract: "evm-rwa-lending",
  },
  [EvmRwaLendingErrorCode.InsufficientCollateral]: {
    code: "InsufficientCollateral",
    message: "Insufficient Collateral",
    contract: "evm-rwa-lending",
  },
  [EvmRwaLendingErrorCode.CollateralAlreadyExists]: {
    code: "CollateralAlreadyExists",
    message: "Collateral Already Exists",
    contract: "evm-rwa-lending",
  },
  [EvmRwaLendingErrorCode.CollateralNotSupported]: {
    code: "CollateralNotSupported",
    message: "Collateral Not Supported",
    contract: "evm-rwa-lending",
  },
  [EvmRwaLendingErrorCode.BorrowNotActive]: {
    code: "BorrowNotActive",
    message: "Borrow Not Active",
    contract: "evm-rwa-lending",
  },
  [EvmRwaLendingErrorCode.BorrowFrozen]: {
    code: "BorrowFrozen",
    message: "Borrow Frozen",
    contract: "evm-rwa-lending",
  },
  [EvmRwaLendingErrorCode.InsufficientBorrowCapacity]: {
    code: "InsufficientBorrowCapacity",
    message: "Insufficient Borrow Capacity",
    contract: "evm-rwa-lending",
  },
  [EvmRwaLendingErrorCode.InsufficientLiquidity]: {
    code: "InsufficientLiquidity",
    message: "Insufficient Liquidity",
    contract: "evm-rwa-lending",
  },
  [EvmRwaLendingErrorCode.BorrowAssetNotSupported]: {
    code: "BorrowAssetNotSupported",
    message: "Borrow Asset Not Supported",
    contract: "evm-rwa-lending",
  },
  [EvmRwaLendingErrorCode.NoBorrowPosition]: {
    code: "NoBorrowPosition",
    message: "No Borrow Position",
    contract: "evm-rwa-lending",
  },
  [EvmRwaLendingErrorCode.PositionHealthy]: {
    code: "PositionHealthy",
    message: "Position Healthy",
    contract: "evm-rwa-lending",
  },
  [EvmRwaLendingErrorCode.InvalidLiquidationAmount]: {
    code: "InvalidLiquidationAmount",
    message: "Invalid Liquidation Amount",
    contract: "evm-rwa-lending",
  },
  [EvmRwaLendingErrorCode.LiquidationNotProfitable]: {
    code: "LiquidationNotProfitable",
    message: "Liquidation Not Profitable",
    contract: "evm-rwa-lending",
  },
  [EvmRwaLendingErrorCode.InvalidInterestRate]: {
    code: "InvalidInterestRate",
    message: "Invalid Interest Rate",
    contract: "evm-rwa-lending",
  },
  [EvmRwaLendingErrorCode.InterestAccrualFailed]: {
    code: "InterestAccrualFailed",
    message: "Interest Accrual Failed",
    contract: "evm-rwa-lending",
  },
  [EvmRwaLendingErrorCode.InvalidPrice]: {
    code: "InvalidPrice",
    message: "Invalid Price",
    contract: "evm-rwa-lending",
  },
  [EvmRwaLendingErrorCode.StalePrice]: {
    code: "StalePrice",
    message: "Stale Price",
    contract: "evm-rwa-lending",
  },
  [EvmRwaLendingErrorCode.OracleNotSet]: {
    code: "OracleNotSet",
    message: "Oracle Not Set",
    contract: "evm-rwa-lending",
  },
  [EvmRwaLendingErrorCode.TransferFailed]: {
    code: "TransferFailed",
    message: "Transfer Failed",
    contract: "evm-rwa-lending",
  },
  [EvmRwaLendingErrorCode.ApprovalFailed]: {
    code: "ApprovalFailed",
    message: "Approval Failed",
    contract: "evm-rwa-lending",
  },
  [EvmRwaLendingErrorCode.InsufficientBalance]: {
    code: "InsufficientBalance",
    message: "Insufficient Balance",
    contract: "evm-rwa-lending",
  },
  [EvmRwaLendingErrorCode.DebtTokenNotTransferable]: {
    code: "DebtTokenNotTransferable",
    message: "Debt Token Not Transferable",
    contract: "evm-rwa-lending",
  },
  [EvmRwaLendingErrorCode.InvalidLTV]: {
    code: "InvalidLTV",
    message: "Invalid LTV",
    contract: "evm-rwa-lending",
  },
  [EvmRwaLendingErrorCode.InvalidLiquidationThreshold]: {
    code: "InvalidLiquidationThreshold",
    message: "Invalid Liquidation Threshold",
    contract: "evm-rwa-lending",
  },
  [EvmRwaLendingErrorCode.InvalidLiquidationBonus]: {
    code: "InvalidLiquidationBonus",
    message: "Invalid Liquidation Bonus",
    contract: "evm-rwa-lending",
  },
  [EvmRwaLendingErrorCode.LTVExceedsLiquidationThreshold]: {
    code: "LTVExceedsLiquidationThreshold",
    message: "LTV Exceeds Liquidation Threshold",
    contract: "evm-rwa-lending",
  },
} as const;

/** Union of all error names defined in evm-rwa-lending */
export type EvmRwaLendingErrorName = keyof typeof EvmRwaLendingErrors;
