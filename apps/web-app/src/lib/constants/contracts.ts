/**
 * Contract Configuration
 * Centralized contract IDs and network configuration for Stellar/Soroban
 */

// Re-export generated contract errors
// These are auto-generated from Rust source files by scripts/generate-error-types.js
// Run `npm run generate:errors` to regenerate
export {
  CONTRACT_ERRORS,
  CONTRACT_ERRORS_BY_CONTRACT,
  type ContractErrorCode,
  type ContractErrorInfo,
  type ContractErrorName,
  type ContractName,
  getErrorsForContract,
  getContractError,
  isValidErrorCode,
  isValidContractErrorCode,
} from "./generated/contract-errors";

export const LENDING_CONTRACT_ID =
  "CD5WNBT4NEYYLALY776KRRR2WP7BEM4VJPG6QYQE5CRO6C5H4YUQA5KS";

export const ORACLE_CONTRACT_ID =
  "CDBRF6JSKUNCRXCKHNSA6DRXKEQNRLVY4TYGPDW3WWWNFPKHRO3G7AYS";
