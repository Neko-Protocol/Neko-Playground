/**
 * AUTO-GENERATED FILE – DO NOT EDIT
 *
 * Generated from : apps/contracts/stellar-contracts/rwa-lending/src/common/error.rs
 * Run            : bash apps/web-app/scripts/generate-error-contract-stellar-enums.bash
 * Generated at   : 2026-02-26T07:22:37Z
 */

export interface RwaLendingErrorEntry {
  readonly code: string;
  readonly message: string;
  readonly contract: string;
}

/** Numeric error codes for the rwa-lending Soroban contract */
export enum RwaLendingErrorCode {
  NotAuthorized = 1,
  NotInitialized = 2,
  AlreadyInitialized = 3,
  NotPositive = 4,
  ArithmeticError = 5,
  InvalidLedgerSequence = 6,
  PoolFrozen = 10,
  PoolOnIce = 11,
  InsufficientPoolBalance = 12,
  InsufficientLiquidity = 13,
  InsufficientBTokenBalance = 20,
  InsufficientDepositAmount = 21,
  InsufficientWithdrawalBalance = 22,
  InsufficientCollateral = 30,
  InsufficientBorrowLimit = 31,
  DebtAssetAlreadySet = 32,
  DebtAssetNotSet = 33,
  CannotSwitchDebtAsset = 34,
  InsufficientDTokenBalance = 35,
  InsufficientDebtToRepay = 36,
  CollateralNotFound = 40,
  CollateralAmountTooLarge = 41,
  InvalidCollateralFactor = 42,
  InvalidInterestRateParams = 50,
  InvalidUtilizationRatio = 51,
  RateAccrualError = 52,
  InvalidUtilRate = 53,
  CDPNotInsolvent = 60,
  AuctionNotFound = 61,
  AuctionNotActive = 62,
  AuctionAlreadyFilled = 63,
  InvalidLiquidationAmount = 64,
  HealthFactorTooHigh = 65,
  HealthFactorTooLow = 66,
  InvalidFillPercent = 67,
  InsufficientBackstopDeposit = 70,
  WithdrawalQueueActive = 71,
  WithdrawalQueueNotExpired = 72,
  BadDebtNotCovered = 73,
  BackstopThresholdNotMet = 74,
  OraclePriceFetchFailed = 80,
  OracleDecimalsFetchFailed = 81,
  InvalidOraclePrice = 82,
  AssetNotFoundInOracle = 83,
  TokenContractNotSet = 84,
}

/** Full error info keyed by numeric code – property order: code → message → contract */
export const RwaLendingErrors: {
  readonly [K in RwaLendingErrorCode]: RwaLendingErrorEntry;
} = {
  [RwaLendingErrorCode.NotAuthorized]: {
    code: "NotAuthorized",
    message: "Not Authorized",
    contract: "rwa-lending",
  },
  [RwaLendingErrorCode.NotInitialized]: {
    code: "NotInitialized",
    message: "Not Initialized",
    contract: "rwa-lending",
  },
  [RwaLendingErrorCode.AlreadyInitialized]: {
    code: "AlreadyInitialized",
    message: "Already Initialized",
    contract: "rwa-lending",
  },
  [RwaLendingErrorCode.NotPositive]: {
    code: "NotPositive",
    message: "Not Positive",
    contract: "rwa-lending",
  },
  [RwaLendingErrorCode.ArithmeticError]: {
    code: "ArithmeticError",
    message: "Arithmetic Error",
    contract: "rwa-lending",
  },
  [RwaLendingErrorCode.InvalidLedgerSequence]: {
    code: "InvalidLedgerSequence",
    message: "Invalid Ledger Sequence",
    contract: "rwa-lending",
  },
  [RwaLendingErrorCode.PoolFrozen]: {
    code: "PoolFrozen",
    message: "Pool Frozen",
    contract: "rwa-lending",
  },
  [RwaLendingErrorCode.PoolOnIce]: {
    code: "PoolOnIce",
    message: "Pool On Ice",
    contract: "rwa-lending",
  },
  [RwaLendingErrorCode.InsufficientPoolBalance]: {
    code: "InsufficientPoolBalance",
    message: "Insufficient Pool Balance",
    contract: "rwa-lending",
  },
  [RwaLendingErrorCode.InsufficientLiquidity]: {
    code: "InsufficientLiquidity",
    message: "Insufficient Liquidity",
    contract: "rwa-lending",
  },
  [RwaLendingErrorCode.InsufficientBTokenBalance]: {
    code: "InsufficientBTokenBalance",
    message: "Insufficient B Token Balance",
    contract: "rwa-lending",
  },
  [RwaLendingErrorCode.InsufficientDepositAmount]: {
    code: "InsufficientDepositAmount",
    message: "Insufficient Deposit Amount",
    contract: "rwa-lending",
  },
  [RwaLendingErrorCode.InsufficientWithdrawalBalance]: {
    code: "InsufficientWithdrawalBalance",
    message: "Insufficient Withdrawal Balance",
    contract: "rwa-lending",
  },
  [RwaLendingErrorCode.InsufficientCollateral]: {
    code: "InsufficientCollateral",
    message: "Insufficient Collateral",
    contract: "rwa-lending",
  },
  [RwaLendingErrorCode.InsufficientBorrowLimit]: {
    code: "InsufficientBorrowLimit",
    message: "Insufficient Borrow Limit",
    contract: "rwa-lending",
  },
  [RwaLendingErrorCode.DebtAssetAlreadySet]: {
    code: "DebtAssetAlreadySet",
    message: "Debt Asset Already Set",
    contract: "rwa-lending",
  },
  [RwaLendingErrorCode.DebtAssetNotSet]: {
    code: "DebtAssetNotSet",
    message: "Debt Asset Not Set",
    contract: "rwa-lending",
  },
  [RwaLendingErrorCode.CannotSwitchDebtAsset]: {
    code: "CannotSwitchDebtAsset",
    message: "Cannot Switch Debt Asset",
    contract: "rwa-lending",
  },
  [RwaLendingErrorCode.InsufficientDTokenBalance]: {
    code: "InsufficientDTokenBalance",
    message: "Insufficient D Token Balance",
    contract: "rwa-lending",
  },
  [RwaLendingErrorCode.InsufficientDebtToRepay]: {
    code: "InsufficientDebtToRepay",
    message: "Insufficient Debt To Repay",
    contract: "rwa-lending",
  },
  [RwaLendingErrorCode.CollateralNotFound]: {
    code: "CollateralNotFound",
    message: "Collateral Not Found",
    contract: "rwa-lending",
  },
  [RwaLendingErrorCode.CollateralAmountTooLarge]: {
    code: "CollateralAmountTooLarge",
    message: "Collateral Amount Too Large",
    contract: "rwa-lending",
  },
  [RwaLendingErrorCode.InvalidCollateralFactor]: {
    code: "InvalidCollateralFactor",
    message: "Invalid Collateral Factor",
    contract: "rwa-lending",
  },
  [RwaLendingErrorCode.InvalidInterestRateParams]: {
    code: "InvalidInterestRateParams",
    message: "Invalid Interest Rate Params",
    contract: "rwa-lending",
  },
  [RwaLendingErrorCode.InvalidUtilizationRatio]: {
    code: "InvalidUtilizationRatio",
    message: "Invalid Utilization Ratio",
    contract: "rwa-lending",
  },
  [RwaLendingErrorCode.RateAccrualError]: {
    code: "RateAccrualError",
    message: "Rate Accrual Error",
    contract: "rwa-lending",
  },
  [RwaLendingErrorCode.InvalidUtilRate]: {
    code: "InvalidUtilRate",
    message: "Invalid Util Rate",
    contract: "rwa-lending",
  },
  [RwaLendingErrorCode.CDPNotInsolvent]: {
    code: "CDPNotInsolvent",
    message: "CDP Not Insolvent",
    contract: "rwa-lending",
  },
  [RwaLendingErrorCode.AuctionNotFound]: {
    code: "AuctionNotFound",
    message: "Auction Not Found",
    contract: "rwa-lending",
  },
  [RwaLendingErrorCode.AuctionNotActive]: {
    code: "AuctionNotActive",
    message: "Auction Not Active",
    contract: "rwa-lending",
  },
  [RwaLendingErrorCode.AuctionAlreadyFilled]: {
    code: "AuctionAlreadyFilled",
    message: "Auction Already Filled",
    contract: "rwa-lending",
  },
  [RwaLendingErrorCode.InvalidLiquidationAmount]: {
    code: "InvalidLiquidationAmount",
    message: "Invalid Liquidation Amount",
    contract: "rwa-lending",
  },
  [RwaLendingErrorCode.HealthFactorTooHigh]: {
    code: "HealthFactorTooHigh",
    message: "Health Factor Too High",
    contract: "rwa-lending",
  },
  [RwaLendingErrorCode.HealthFactorTooLow]: {
    code: "HealthFactorTooLow",
    message: "Health Factor Too Low",
    contract: "rwa-lending",
  },
  [RwaLendingErrorCode.InvalidFillPercent]: {
    code: "InvalidFillPercent",
    message: "Invalid Fill Percent",
    contract: "rwa-lending",
  },
  [RwaLendingErrorCode.InsufficientBackstopDeposit]: {
    code: "InsufficientBackstopDeposit",
    message: "Insufficient Backstop Deposit",
    contract: "rwa-lending",
  },
  [RwaLendingErrorCode.WithdrawalQueueActive]: {
    code: "WithdrawalQueueActive",
    message: "Withdrawal Queue Active",
    contract: "rwa-lending",
  },
  [RwaLendingErrorCode.WithdrawalQueueNotExpired]: {
    code: "WithdrawalQueueNotExpired",
    message: "Withdrawal Queue Not Expired",
    contract: "rwa-lending",
  },
  [RwaLendingErrorCode.BadDebtNotCovered]: {
    code: "BadDebtNotCovered",
    message: "Bad Debt Not Covered",
    contract: "rwa-lending",
  },
  [RwaLendingErrorCode.BackstopThresholdNotMet]: {
    code: "BackstopThresholdNotMet",
    message: "Backstop Threshold Not Met",
    contract: "rwa-lending",
  },
  [RwaLendingErrorCode.OraclePriceFetchFailed]: {
    code: "OraclePriceFetchFailed",
    message: "Oracle Price Fetch Failed",
    contract: "rwa-lending",
  },
  [RwaLendingErrorCode.OracleDecimalsFetchFailed]: {
    code: "OracleDecimalsFetchFailed",
    message: "Oracle Decimals Fetch Failed",
    contract: "rwa-lending",
  },
  [RwaLendingErrorCode.InvalidOraclePrice]: {
    code: "InvalidOraclePrice",
    message: "Invalid Oracle Price",
    contract: "rwa-lending",
  },
  [RwaLendingErrorCode.AssetNotFoundInOracle]: {
    code: "AssetNotFoundInOracle",
    message: "Asset Not Found In Oracle",
    contract: "rwa-lending",
  },
  [RwaLendingErrorCode.TokenContractNotSet]: {
    code: "TokenContractNotSet",
    message: "Token Contract Not Set",
    contract: "rwa-lending",
  },
} as const;

/** Union of all error names defined in rwa-lending */
export type RwaLendingErrorName = keyof typeof RwaLendingErrors;
