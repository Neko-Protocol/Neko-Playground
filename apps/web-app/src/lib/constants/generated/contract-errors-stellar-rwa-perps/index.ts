/**
 * AUTO-GENERATED FILE – DO NOT EDIT
 *
 * Generated from : apps/contracts/stellar-contracts/rwa-perps/src/common/error.rs
 * Run            : bash apps/web-app/scripts/generate-error-contract-stellar-enums.bash
 * Generated at   : 2026-02-26T07:22:37Z
 */

export interface RwaPerpsErrorEntry {
  readonly code: string;
  readonly message: string;
  readonly contract: string;
}

/** Numeric error codes for the rwa-perps Soroban contract */
export enum RwaPerpsErrorCode {
  PositionNotFound = 1,
  PositionAlreadyExists = 2,
  PositionNotLiquidatable = 3,
  MarginRatioHealthy = 10,
  InsufficientMargin = 11,
  LiquidationPriceTooLow = 12,
  LiquidationPriceTooHigh = 13,
  MarketNotFound = 20,
  MarketInactive = 21,
  OraclePriceNotFound = 30,
  OraclePriceStale = 31,
  ArithmeticError = 40,
  Overflow = 41,
  DivisionByZero = 42,
  Unauthorized = 50,
  InvalidInput = 60,
  NotInitialized = 61,
  AlreadyInitialized = 62,
  ProtocolPaused = 63,
  InvalidFundingRate = 70,
  FundingCalculationError = 71,
  MarginRatioBelowMaintenance = 72,
  MarginTokenNotSet = 73,
  ExceedsMaxLeverage = 80,
  InsufficientInitialMargin = 81,
}

/** Full error info keyed by numeric code – property order: code → message → contract */
export const RwaPerpsErrors: {
  readonly [K in RwaPerpsErrorCode]: RwaPerpsErrorEntry;
} = {
  [RwaPerpsErrorCode.PositionNotFound]: {
    code: "PositionNotFound",
    message: "Position Not Found",
    contract: "rwa-perps",
  },
  [RwaPerpsErrorCode.PositionAlreadyExists]: {
    code: "PositionAlreadyExists",
    message: "Position Already Exists",
    contract: "rwa-perps",
  },
  [RwaPerpsErrorCode.PositionNotLiquidatable]: {
    code: "PositionNotLiquidatable",
    message: "Position Not Liquidatable",
    contract: "rwa-perps",
  },
  [RwaPerpsErrorCode.MarginRatioHealthy]: {
    code: "MarginRatioHealthy",
    message: "Margin Ratio Healthy",
    contract: "rwa-perps",
  },
  [RwaPerpsErrorCode.InsufficientMargin]: {
    code: "InsufficientMargin",
    message: "Insufficient Margin",
    contract: "rwa-perps",
  },
  [RwaPerpsErrorCode.LiquidationPriceTooLow]: {
    code: "LiquidationPriceTooLow",
    message: "Liquidation Price Too Low",
    contract: "rwa-perps",
  },
  [RwaPerpsErrorCode.LiquidationPriceTooHigh]: {
    code: "LiquidationPriceTooHigh",
    message: "Liquidation Price Too High",
    contract: "rwa-perps",
  },
  [RwaPerpsErrorCode.MarketNotFound]: {
    code: "MarketNotFound",
    message: "Market Not Found",
    contract: "rwa-perps",
  },
  [RwaPerpsErrorCode.MarketInactive]: {
    code: "MarketInactive",
    message: "Market Inactive",
    contract: "rwa-perps",
  },
  [RwaPerpsErrorCode.OraclePriceNotFound]: {
    code: "OraclePriceNotFound",
    message: "Oracle Price Not Found",
    contract: "rwa-perps",
  },
  [RwaPerpsErrorCode.OraclePriceStale]: {
    code: "OraclePriceStale",
    message: "Oracle Price Stale",
    contract: "rwa-perps",
  },
  [RwaPerpsErrorCode.ArithmeticError]: {
    code: "ArithmeticError",
    message: "Arithmetic Error",
    contract: "rwa-perps",
  },
  [RwaPerpsErrorCode.Overflow]: {
    code: "Overflow",
    message: "Overflow",
    contract: "rwa-perps",
  },
  [RwaPerpsErrorCode.DivisionByZero]: {
    code: "DivisionByZero",
    message: "Division By Zero",
    contract: "rwa-perps",
  },
  [RwaPerpsErrorCode.Unauthorized]: {
    code: "Unauthorized",
    message: "Unauthorized",
    contract: "rwa-perps",
  },
  [RwaPerpsErrorCode.InvalidInput]: {
    code: "InvalidInput",
    message: "Invalid Input",
    contract: "rwa-perps",
  },
  [RwaPerpsErrorCode.NotInitialized]: {
    code: "NotInitialized",
    message: "Not Initialized",
    contract: "rwa-perps",
  },
  [RwaPerpsErrorCode.AlreadyInitialized]: {
    code: "AlreadyInitialized",
    message: "Already Initialized",
    contract: "rwa-perps",
  },
  [RwaPerpsErrorCode.ProtocolPaused]: {
    code: "ProtocolPaused",
    message: "Protocol Paused",
    contract: "rwa-perps",
  },
  [RwaPerpsErrorCode.InvalidFundingRate]: {
    code: "InvalidFundingRate",
    message: "Invalid Funding Rate",
    contract: "rwa-perps",
  },
  [RwaPerpsErrorCode.FundingCalculationError]: {
    code: "FundingCalculationError",
    message: "Funding Calculation Error",
    contract: "rwa-perps",
  },
  [RwaPerpsErrorCode.MarginRatioBelowMaintenance]: {
    code: "MarginRatioBelowMaintenance",
    message: "Margin removal would violate maintenance requirement",
    contract: "rwa-perps",
  },
  [RwaPerpsErrorCode.MarginTokenNotSet]: {
    code: "MarginTokenNotSet",
    message: "Margin token not configured",
    contract: "rwa-perps",
  },
  [RwaPerpsErrorCode.ExceedsMaxLeverage]: {
    code: "ExceedsMaxLeverage",
    message: "Leverage exceeds market maximum",
    contract: "rwa-perps",
  },
  [RwaPerpsErrorCode.InsufficientInitialMargin]: {
    code: "InsufficientInitialMargin",
    message: "Margin below initial requirement",
    contract: "rwa-perps",
  },
} as const;

/** Union of all error names defined in rwa-perps */
export type RwaPerpsErrorName = keyof typeof RwaPerpsErrors;
