const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const CONTRACTS_DIR = path.resolve(
  __dirname,
  "../apps/contracts/stellar-contracts"
);
const OUTPUT_FILE = path.resolve(
  __dirname,
  "../apps/web-app/src/lib/constants/generated/contract-errors.ts"
);

const ERROR_MESSAGES = {
  "rwa-lending": {
    NotAuthorized:
      "Authorization failed. Ensure you have sufficient token balance and have approved the transaction",
    NotInitialized: "The lending protocol has not been initialized yet",
    AlreadyInitialized: "The lending protocol is already initialized",
    NotPositive: "The amount must be greater than zero",
    ArithmeticError:
      "A calculation error occurred. Please try a different amount",
    InvalidLedgerSequence: "Invalid transaction timing. Please try again",
    PoolFrozen: "This pool is currently frozen and not accepting transactions",
    PoolOnIce: "This pool is temporarily paused. Please try again later",
    InsufficientPoolBalance:
      "Insufficient liquidity in the pool. Try a smaller amount",
    InsufficientLiquidity: "Not enough funds available in the pool",
    InsufficientBTokenBalance: "Insufficient bToken balance for this operation",
    InsufficientDepositAmount: "Deposit amount is too small",
    InsufficientWithdrawalBalance: "Insufficient balance for withdrawal",
    InsufficientCollateral: "Not enough collateral to complete this operation",
    InsufficientBorrowLimit:
      "Borrow amount exceeds your limit. Add more collateral",
    DebtAssetAlreadySet: "Debt asset has already been set",
    DebtAssetNotSet: "No debt asset has been set",
    CannotSwitchDebtAsset: "Cannot switch debt asset while having active debt",
    InsufficientDTokenBalance: "Insufficient debt token balance",
    InsufficientDebtToRepay: "Repayment amount exceeds your debt",
    CollateralNotFound: "Collateral asset not found",
    CollateralAmountTooLarge: "Collateral amount exceeds available balance",
    InvalidCollateralFactor: "Invalid collateral factor configuration",
    InvalidInterestRateParams: "Invalid interest rate parameters",
    InvalidUtilizationRatio: "Invalid utilization ratio",
    RateAccrualError: "Error accruing interest rates",
    InvalidUtilRate: "Invalid utilization rate",
    CDPNotInsolvent: "Position is not eligible for liquidation",
    AuctionNotFound: "Liquidation auction not found",
    AuctionNotActive: "Liquidation auction is not active",
    AuctionAlreadyFilled: "Liquidation auction has already been filled",
    InvalidLiquidationAmount: "Invalid liquidation amount",
    HealthFactorTooHigh: "Health factor is too high for liquidation",
    HealthFactorTooLow: "Health factor is too low",
    InvalidFillPercent: "Invalid fill percentage for auction",
    InsufficientBackstopDeposit: "Insufficient backstop deposit",
    WithdrawalQueueActive: "Withdrawal queue is currently active",
    WithdrawalQueueNotExpired: "Withdrawal queue has not expired yet",
    BadDebtNotCovered: "Bad debt has not been covered",
    BackstopThresholdNotMet: "Backstop threshold has not been met",
    OraclePriceFetchFailed: "Failed to fetch price from oracle",
    OracleDecimalsFetchFailed: "Failed to fetch decimals from oracle",
    InvalidOraclePrice:
      "The oracle price for this asset is stale or unavailable. Please try again later",
    AssetNotFoundInOracle: "Asset not found in oracle",
    TokenContractNotSet: "Token contract has not been set",
  },
  "rwa-oracle": {
    AssetNotFound: "Asset not found in the oracle",
    AssetAlreadyExists: "Asset already exists in the oracle",
    InvalidRWAType: "Invalid RWA type specified",
    InvalidMetadata: "Invalid metadata provided",
    InvalidPrice: "Invalid price (zero or negative)",
    Unauthorized: "Unauthorized access",
    TimestampInFuture: "Timestamp is too far in the future",
    TimestampTooOld: "Timestamp is too old or not strictly increasing",
  },
  "rwa-token": {
    InsufficientBalance: "Insufficient token balance",
    InvalidLedgerSequence: "Invalid transaction timing. Please try again",
    OraclePriceFetchFailed: "Failed to fetch price from oracle",
    OracleDecimalsFetchFailed: "Failed to fetch decimals from oracle",
    ValueNotPositive: "Value must be greater than or equal to 0",
    InsufficientAllowance:
      "Insufficient allowance; spender must call approve first",
    ArithmeticError:
      "A calculation error occurred. Please try a different amount",
    CannotTransferToSelf: "Cannot transfer to self",
    AddressFrozen: "Address is frozen (not authorized for transfers)",
    ComplianceCheckFailed:
      "Compliance check failed (transfer rejected by compliance contract)",
    MetadataNotFound: "Metadata not found in RWA Oracle",
    NotInitialized: "The lending protocol has not been initialized yet",
    AlreadyInitialized: "The lending protocol is already initialized",
  },
  "rwa-perps": {
    PositionNotFound: "Position not found",
    PositionAlreadyExists: "Position already exists",
    PositionNotLiquidatable: "Position is not liquidatable",
    MarginRatioHealthy: "Margin ratio is healthy",
    InsufficientMargin: "Insufficient margin",
    LiquidationPriceTooLow: "Liquidation price is too low",
    LiquidationPriceTooHigh: "Liquidation price is too high",
    MarketNotFound: "Market not found",
    MarketInactive: "Market is inactive",
    OraclePriceNotFound: "Oracle price not found",
    OraclePriceStale: "Oracle price is stale",
    ArithmeticError:
      "A calculation error occurred. Please try a different amount",
    Overflow: "Arithmetic overflow occurred",
    DivisionByZero: "Division by zero",
    Unauthorized: "Unauthorized access",
    InvalidInput: "Invalid input provided",
    NotInitialized: "The lending protocol has not been initialized yet",
    AlreadyInitialized: "The lending protocol is already initialized",
    ProtocolPaused: "Protocol is paused",
    InvalidFundingRate: "Invalid funding rate",
    FundingCalculationError: "Funding calculation error",
    MarginRatioBelowMaintenance:
      "Margin removal would violate maintenance requirement",
    MarginTokenNotSet: "Margin token not configured",
    ExceedsMaxLeverage: "Leverage exceeds market maximum",
    InsufficientInitialMargin: "Margin below initial requirement",
  },
};

function findErrorFiles() {
  const results = [];
  const contracts = fs.readdirSync(CONTRACTS_DIR);

  for (const contract of contracts) {
    const contractDir = path.join(CONTRACTS_DIR, contract);
    if (!fs.statSync(contractDir).isDirectory()) continue;

    const candidates = [
      path.join(contractDir, "src", "common", "error.rs"),
      path.join(contractDir, "src", "error.rs"),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        const relativePath = path.relative(
          path.resolve(__dirname, ".."),
          candidate
        );
        results.push({
          contract,
          absolutePath: candidate,
          relativePath,
        });
        break;
      }
    }
  }

  return results;
}

function parseErrorEnum(source) {
  const variants = [];
  const enumMatch = source.match(
    /#\[contracterror\][\s\S]*?pub\s+enum\s+\w+\s*\{([\s\S]*?)\}/
  );
  if (!enumMatch) return variants;

  const body = enumMatch[1];
  const variantRegex =
    /(?:\/\/\/\s*(.*?)\n\s*|\/\/\s*(.*?)\n\s*)?(\w+)\s*=\s*(\d+)/g;
  let match;

  while ((match = variantRegex.exec(body)) !== null) {
    const docComment = match[1] || match[2] || null;
    const name = match[3];
    const code = parseInt(match[4], 10);
    variants.push({ name, code, docComment });
  }

  return variants;
}

function pascalToMessage(name) {
  return name
    .replace(/([A-Z])/g, " $1")
    .trim()
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase());
}

function getMessage(contractName, variantName, docComment) {
  const overrides = ERROR_MESSAGES[contractName];
  if (overrides && overrides[variantName]) {
    return overrides[variantName];
  }

  if (docComment) {
    return docComment.charAt(0).toUpperCase() + docComment.slice(1);
  }

  return pascalToMessage(variantName);
}

function generate() {
  const errorFiles = findErrorFiles();
  if (errorFiles.length === 0) {
    console.error("No error.rs files found in", CONTRACTS_DIR);
    process.exit(1);
  }

  console.log(`Found ${errorFiles.length} contract error files:`);
  errorFiles.forEach((f) => console.log(`  - ${f.relativePath}`));

  const allErrors = [];

  for (const file of errorFiles) {
    const source = fs.readFileSync(file.absolutePath, "utf-8");
    const variants = parseErrorEnum(source);
    for (const variant of variants) {
      allErrors.push({
        code: variant.code,
        name: variant.name,
        message: getMessage(file.contract, variant.name, variant.docComment),
        contract: file.contract,
      });
    }
  }

  const sourceList = errorFiles.map((f) => ` *   - ${f.relativePath}`);

  let output = `/**
 * AUTO-GENERATED FILE - DO NOT EDIT
 *
 * This file is automatically generated from Stellar smart contract error definitions.
 * To regenerate, run: npm run generate:errors
 *
 * Generated at: ${new Date().toISOString()}
 *
 * Source files:
${sourceList.join("\n")}
 */

export interface ContractErrorInfo {
  /** The error code name from the contract */
  code: string;
  /** Human-readable error message */
  message: string;
  /** The contract that defines this error */
  contract: string;
}

/**
 * Contract error definitions mapped by error code number.
 * These are parsed from the Rust #[contracterror] enums in the smart contracts.
 *
 * Multiple contracts may share the same numeric error code.
 * When codes overlap, the last contract's definition takes precedence
 * for numeric lookups. Use getErrorsForContract() for contract-specific errors.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _errorEntries: [number, ContractErrorInfo][] = [\n`;

  for (const error of allErrors) {
    const escapedMessage = error.message.replace(/"/g, '\\"');
    output += `  [\n`;
    output += `    ${error.code},\n`;
    output += `    {\n`;
    output += `      code: "${error.name}",\n`;

    if (escapedMessage.length > 60) {
      output += `      message:\n`;
      output += `        "${escapedMessage}",\n`;
    } else {
      output += `      message: "${escapedMessage}",\n`;
    }

    output += `      contract: "${error.contract}",\n`;
    output += `    },\n`;
    output += `  ],\n`;
  }

  output += `];

export const CONTRACT_ERRORS: Record<number, ContractErrorInfo> =
  Object.fromEntries(_errorEntries) as Record<number, ContractErrorInfo>;

/** Valid contract error code numbers */
export type ContractErrorCode = keyof typeof CONTRACT_ERRORS;

/** Error code names */
export type ContractErrorName =
  (typeof CONTRACT_ERRORS)[ContractErrorCode]["code"];

/** Contract names that have error definitions */
export type ContractName =
  (typeof CONTRACT_ERRORS)[ContractErrorCode]["contract"];

/**
 * Get all error codes for a specific contract
 */
export function getErrorsForContract(
  contractName: string
): ContractErrorInfo[] {
  return Object.values(CONTRACT_ERRORS).filter(
    (error) => error.contract === contractName
  );
}

/**
 * Check if an error code exists
 */
export function isValidErrorCode(code: number): code is ContractErrorCode {
  return code in CONTRACT_ERRORS;
}

/**
 * Errors grouped by contract name, then by error code.
 * Use this for contract-specific lookups when multiple contracts share the same code.
 */
export const CONTRACT_ERRORS_BY_CONTRACT: Record<string, Record<number, ContractErrorInfo>> = (() => {
  const byContract: Record<string, Record<number, ContractErrorInfo>> = {};
  for (const [code, info] of Object.entries(CONTRACT_ERRORS)) {
    const n = Number(code);
    if (!byContract[info.contract]) byContract[info.contract] = {};
    byContract[info.contract][n] = info;
  }
  return byContract;
})();

/**
 * Get error info for a specific contract and error code.
 * Use when the same numeric code exists in multiple contracts.
 */
export function getContractError(
  contractName: string,
  code: number
): ContractErrorInfo | undefined {
  const contractErrors = CONTRACT_ERRORS_BY_CONTRACT[contractName];
  return contractErrors ? contractErrors[code] : undefined;
}

/**
 * Check if an error code is valid for a specific contract
 */
export function isValidContractErrorCode(
  contractName: string,
  code: number
): boolean {
  return getContractError(contractName, code) !== undefined;
}
`;

  const outputDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_FILE, output, "utf-8");
  console.log(`\nGenerated ${OUTPUT_FILE}`);
  console.log(`Total error definitions: ${allErrors.length}`);
}

generate();
