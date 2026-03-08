import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}

export const networks = {
  testnet: {
    networkPassphrase: "Test SDF Network ; September 2015",
    /** Pool 1 — RWA collateral → borrow USDC/XLM */
    contractId: "CD2ZCQLGQZRUBHO77QVGJXNFP6Y6UIQBBYG5WG6EX5PTQQDNEQITNB5J",
    pool1ContractId: "CD2ZCQLGQZRUBHO77QVGJXNFP6Y6UIQBBYG5WG6EX5PTQQDNEQITNB5J",
    /** Pool 2 — USDC/XLM collateral → borrow RWA tokens */
    pool2ContractId: "CBSA75HUIMPR552MZLQFDZ4DH64IUHL3NR3NCJ2ZB4WY3QH3D7MH5HP4",
  },
} as const;

export const Errors = {
  1: { message: "NotAuthorized" },
  2: { message: "NotInitialized" },
  3: { message: "AlreadyInitialized" },
  4: { message: "NotPositive" },
  5: { message: "ArithmeticError" },
  6: { message: "InvalidLedgerSequence" },
  10: { message: "PoolFrozen" },
  11: { message: "PoolOnIce" },
  12: { message: "InsufficientPoolBalance" },
  13: { message: "InsufficientLiquidity" },
  20: { message: "InsufficientBTokenBalance" },
  21: { message: "InsufficientDepositAmount" },
  22: { message: "InsufficientWithdrawalBalance" },
  30: { message: "InsufficientCollateral" },
  31: { message: "InsufficientBorrowLimit" },
  32: { message: "DebtAssetAlreadySet" },
  33: { message: "DebtAssetNotSet" },
  34: { message: "CannotSwitchDebtAsset" },
  35: { message: "InsufficientDTokenBalance" },
  36: { message: "InsufficientDebtToRepay" },
  40: { message: "CollateralNotFound" },
  41: { message: "CollateralAmountTooLarge" },
  42: { message: "InvalidCollateralFactor" },
  50: { message: "InvalidInterestRateParams" },
  51: { message: "InvalidUtilizationRatio" },
  52: { message: "RateAccrualError" },
  53: { message: "InvalidUtilRate" },
  60: { message: "CDPNotInsolvent" },
  61: { message: "AuctionNotFound" },
  62: { message: "AuctionNotActive" },
  63: { message: "AuctionAlreadyFilled" },
  64: { message: "InvalidLiquidationAmount" },
  65: { message: "HealthFactorTooHigh" },
  66: { message: "HealthFactorTooLow" },
  67: { message: "InvalidFillPercent" },
  70: { message: "InsufficientBackstopDeposit" },
  71: { message: "WithdrawalQueueActive" },
  72: { message: "WithdrawalQueueNotExpired" },
  73: { message: "BadDebtNotCovered" },
  74: { message: "BackstopThresholdNotMet" },
  80: { message: "OraclePriceFetchFailed" },
  81: { message: "OracleDecimalsFetchFailed" },
  82: { message: "InvalidOraclePrice" },
  83: { message: "AssetNotFoundInOracle" },
  84: { message: "TokenContractNotSet" },
  85: { message: "TreasuryNotSet" },
  86: { message: "NoTreasuryFeesToCollect" },
};

export interface CDP {
  /**
   * Collateral (RWA tokens): token address -> amount
   */
  collateral: Map<string, i128>;
  /**
   * Creation timestamp
   */
  created_at: u64;
  /**
   * dTokens of the borrowed asset
   */
  d_tokens: i128;
  /**
   * Debt asset symbol (only one: USDC, XLM, etc.)
   */
  debt_asset: Option<string>;
  /**
   * Last update timestamp
   */
  last_update: u64;
}

/**
 * Determines which oracle to use for price queries.
 * - Crypto: uses the Reflector oracle (USDC, XLM, etc.)
 * - Rwa: uses the RWA oracle (USDY, CETES, etc.)
 */
export type AssetType =
  | { tag: "Crypto"; values: void }
  | { tag: "Rwa"; values: void };

export type PoolState =
  | { tag: "Active"; values: void }
  | { tag: "OnIce"; values: void }
  | { tag: "Frozen"; values: void };

/**
 * Price data from oracle (SEP-40 compatible)
 */
export interface PriceData {
  price: i128;
  timestamp: u64;
}

/**
 * Dutch Auction data structure (unified for all auction types)
 */
export interface AuctionData {
  /**
   * Type of auction
   */
  auction_type: AuctionType;
  /**
   * Assets/tokens being bid (what filler pays)
   * For UserLiquidation: debt tokens
   * For BadDebt: underlying debt asset
   * For Interest: backstop tokens
   */
  bid: Map<string, i128>;
  /**
   * Auction start block
   */
  block: u32;
  /**
   * Assets/tokens being auctioned (what filler receives)
   * For UserLiquidation: collateral tokens
   * For BadDebt: backstop tokens
   * For Interest: interest tokens
   */
  lot: Map<string, i128>;
  /**
   * The user associated with this auction
   * For UserLiquidation: the borrower being liquidated
   * For BadDebt: the borrower with bad debt
   * For Interest: the contract itself (protocol)
   */
  user: string;
}

/**
 * Type of auction
 */
export enum AuctionType {
  UserLiquidation = 0,
  BadDebt = 1,
  Interest = 2,
}

/**
 * Reserve state data for an asset
 * Token rates use 12 decimals (SCALAR_12)
 */
export interface ReserveData {
  /**
   * bToken to underlying conversion rate (12 decimals)
   * underlying = b_tokens * b_rate / SCALAR_12
   */
  b_rate: i128;
  /**
   * Total bToken supply
   */
  b_supply: i128;
  /**
   * Interest owed to backstop (accumulated)
   */
  backstop_credit: i128;
  /**
   * dToken to underlying conversion rate (12 decimals)
   * underlying = d_tokens * d_rate / SCALAR_12
   */
  d_rate: i128;
  /**
   * Total dToken supply
   */
  d_supply: i128;
  /**
   * Interest rate modifier (7 decimals)
   * Adjusts dynamically based on utilization vs target
   * Range: SCALAR_7 / 10 to SCALAR_7 * 10 (0.1x to 10x)
   */
  ir_mod: i128;
  /**
   * Last interest accrual timestamp
   */
  last_time: u64;
  /**
   * Fees owed to treasury (accumulated: reserve factor + origination fees)
   */
  treasury_credit: i128;
}

/**
 * Backstop deposit record
 */
export interface BackstopDeposit {
  /**
   * Deposit amount (LP tokens or native tokens)
   */
  amount: i128;
  /**
   * Deposit timestamp
   */
  deposited_at: u64;
  /**
   * Whether in withdrawal queue
   */
  in_withdrawal_queue: boolean;
  /**
   * Queue entry timestamp (if queued)
   */
  queued_at: Option<u64>;
}

/**
 * Withdrawal request (Queue for Withdrawal - Q4W)
 */
export interface WithdrawalRequest {
  address: string;
  amount: i128;
  queued_at: u64;
}

/**
 * Interest rate parameters for a reserve
 * All values in 7 decimals (SCALAR_7)
 *
 * Example configuration for USDC:
 * ```
 * InterestRateParams {
 * target_util: 7_500_000,    // 75%
 * max_util: 9_500_000,       // 95%
 * r_base: 100_000,           // 1% base rate
 * r_one: 500_000,            // 5% slope to target
 * r_two: 5_000_000,          // 50% slope to max
 * r_three: 15_000_000,       // 150% slope above max
 * reactivity: 200,           // 0.00002 reactivity
 * }
 * ```
 */
export interface InterestRateParams {
  /**
   * Maximum utilization rate before extreme rates kick in (7 decimals, e.g., 9_500_000 = 95%)
   */
  max_util: u32;
  /**
   * Base interest rate R0 (7 decimals, always applied)
   */
  r_base: u32;
  /**
   * Interest rate slope R1 (7 decimals, applied up to target_util)
   */
  r_one: u32;
  /**
   * Interest rate slope R3 (7 decimals, applied above max_util)
   */
  r_three: u32;
  /**
   * Interest rate slope R2 (7 decimals, applied from target_util to max_util)
   */
  r_two: u32;
  /**
   * Reactivity constant for rate modifier adjustment (7 decimals)
   */
  reactivity: u32;
  /**
   * Target utilization rate (7 decimals, e.g., 7_500_000 = 75%)
   */
  target_util: u32;
}

/**
 * Main pool storage structure
 */
export interface PoolStorage {
  admin: string;
  asset_types: Map<string, AssetType>;
  auction_data: Map<u32, AuctionData>;
  b_token_balances: Map<string, Map<string, i128>>;
  backstop_deposits: Map<string, BackstopDeposit>;
  backstop_take_rate: u32;
  backstop_threshold: i128;
  backstop_token: Option<string>;
  backstop_total: i128;
  collateral: Map<string, Map<string, i128>>;
  collateral_asset_types: Map<string, AssetType>;
  collateral_factors: Map<string, u32>;
  collateral_symbols: Map<string, string>;
  d_token_balances: Map<string, Map<string, i128>>;
  interest_rate_params: Map<string, InterestRateParams>;
  liquidation_fee_rate: u32;
  origination_fee_rate: u32;
  pool_balances: Map<string, i128>;
  pool_state: PoolState;
  reflector_oracle: string;
  reserve_data: Map<string, ReserveData>;
  reserve_factor: u32;
  rwa_oracle: string;
  token_contracts: Map<string, string>;
  treasury: string;
  withdrawal_queue: Array<WithdrawalRequest>;
}

export interface Client {
  /**
   * Construct and simulate a repay transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Repay debt
   */
  repay: (
    {
      borrower,
      asset,
      d_tokens,
    }: { borrower: string; asset: string; d_tokens: i128 },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<Result<i128>>>;

  /**
   * Construct and simulate a borrow transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Borrow crypto asset from the pool
   */
  borrow: (
    {
      borrower,
      asset,
      amount,
    }: { borrower: string; asset: string; amount: i128 },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<Result<i128>>>;

  /**
   * Construct and simulate a deposit transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Deposit crypto asset to the pool
   */
  deposit: (
    { lender, asset, amount }: { lender: string; asset: string; amount: i128 },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<Result<i128>>>;

  /**
   * Construct and simulate a upgrade transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Upgrade the contract to a new WASM hash
   * Only the admin can call this function
   */
  upgrade: (
    { new_wasm_hash }: { new_wasm_hash: Buffer },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a withdraw transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Withdraw crypto asset from the pool
   */
  withdraw: (
    {
      lender,
      asset,
      b_tokens,
    }: { lender: string; asset: string; b_tokens: i128 },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<Result<i128>>>;

  /**
   * Construct and simulate a initialize transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Initialize the lending pool
   */
  initialize: (
    {
      admin,
      treasury,
      rwa_oracle,
      reflector_oracle,
      backstop_threshold,
      backstop_take_rate,
      reserve_factor,
      origination_fee_rate,
      liquidation_fee_rate,
    }: {
      admin: string;
      treasury: string;
      rwa_oracle: string;
      reflector_oracle: string;
      backstop_threshold: i128;
      backstop_take_rate: u32;
      reserve_factor: u32;
      origination_fee_rate: u32;
      liquidation_fee_rate: u32;
    },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a fill_auction transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Fill a liquidation auction
   */
  fill_auction: (
    { auction_id, liquidator }: { auction_id: u32; liquidator: string },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<Result<void>>>;

  /**
   * Construct and simulate a get_treasury transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get treasury address
   */
  get_treasury: (
    options?: MethodOptions
  ) => Promise<AssembledTransaction<string>>;

  /**
   * Construct and simulate a has_bad_debt transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Check if a borrower has bad debt
   */
  has_bad_debt: (
    { borrower }: { borrower: string },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<boolean>>;

  /**
   * Construct and simulate a set_treasury transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Set treasury address. Admin-only.
   */
  set_treasury: (
    { treasury }: { treasury: string },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a add_collateral transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Add RWA token collateral
   */
  add_collateral: (
    {
      borrower,
      rwa_token,
      amount,
    }: { borrower: string; rwa_token: string; amount: i128 },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<Result<void>>>;

  /**
   * Construct and simulate a get_collateral transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get collateral amount for a borrower and RWA token
   */
  get_collateral: (
    { borrower, rwa_token }: { borrower: string; rwa_token: string },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<i128>>;

  /**
   * Construct and simulate a get_pool_state transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get pool state
   */
  get_pool_state: (
    options?: MethodOptions
  ) => Promise<AssembledTransaction<PoolState>>;

  /**
   * Construct and simulate a set_pool_state transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Set pool state
   */
  set_pool_state: (
    { state }: { state: PoolState },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a accrue_interest transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Accrue interest for an asset
   */
  accrue_interest: (
    { asset }: { asset: string },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<Result<void>>>;

  /**
   * Construct and simulate a get_b_token_rate transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get bTokenRate for an asset
   */
  get_b_token_rate: (
    { asset }: { asset: string },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<i128>>;

  /**
   * Construct and simulate a get_d_token_rate transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get dTokenRate for an asset
   */
  get_d_token_rate: (
    { asset }: { asset: string },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<i128>>;

  /**
   * Construct and simulate a get_pool_balance transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get pool balance for an asset
   */
  get_pool_balance: (
    { asset }: { asset: string },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<i128>>;

  /**
   * Construct and simulate a get_interest_rate transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get current interest rate for an asset
   */
  get_interest_rate: (
    { asset }: { asset: string },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<Result<i128>>>;

  /**
   * Construct and simulate a remove_collateral transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Remove RWA token collateral
   */
  remove_collateral: (
    {
      borrower,
      rwa_token,
      amount,
    }: { borrower: string; rwa_token: string; amount: i128 },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<Result<void>>>;

  /**
   * Construct and simulate a get_b_token_supply transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get total bToken supply for an asset
   */
  get_b_token_supply: (
    { asset }: { asset: string },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<i128>>;

  /**
   * Construct and simulate a set_backstop_token transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Set backstop token contract address
   */
  set_backstop_token: (
    { token_address }: { token_address: string },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a set_reserve_factor transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Set reserve factor (7 decimals, e.g. 1_000_000 = 10%). Admin-only.
   */
  set_reserve_factor: (
    { reserve_factor }: { reserve_factor: u32 },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a set_token_contract transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Set token contract address for an asset symbol
   * asset_type: Rwa for RWA tokens (uses RWA oracle), Crypto for stable/crypto tokens (uses Reflector oracle)
   */
  set_token_contract: (
    {
      asset,
      token_address,
      asset_type,
    }: { asset: string; token_address: string; asset_type: AssetType },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a deposit_to_backstop transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Deposit to backstop
   */
  deposit_to_backstop: (
    { depositor, amount }: { depositor: string; amount: i128 },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<Result<void>>>;

  /**
   * Construct and simulate a get_b_token_balance transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get bToken balance for a lender
   */
  get_b_token_balance: (
    { lender, asset }: { lender: string; asset: string },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<i128>>;

  /**
   * Construct and simulate a get_d_token_balance transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get dToken balance for a borrower
   */
  get_d_token_balance: (
    { borrower, asset }: { borrower: string; asset: string },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<i128>>;

  /**
   * Construct and simulate a get_treasury_credit transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get accumulated treasury fees (not yet collected) for an asset.
   */
  get_treasury_credit: (
    { asset }: { asset: string },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<i128>>;

  /**
   * Construct and simulate a initiate_liquidation transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Initiate liquidation for a borrower
   */
  initiate_liquidation: (
    {
      borrower,
      rwa_token,
      debt_asset,
      liquidation_percent,
    }: {
      borrower: string;
      rwa_token: string;
      debt_asset: string;
      liquidation_percent: u32;
    },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<Result<u32>>>;

  /**
   * Construct and simulate a collect_treasury_fees transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Collect accumulated treasury fees for an asset and transfer to treasury address. Admin-only.
   */
  collect_treasury_fees: (
    { asset }: { asset: string },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<Result<i128>>>;

  /**
   * Construct and simulate a fill_bad_debt_auction transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Fill a bad debt auction
   */
  fill_bad_debt_auction: (
    {
      auction_id,
      bidder,
      amount,
    }: { auction_id: u32; bidder: string; amount: i128 },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<Result<i128>>>;

  /**
   * Construct and simulate a fill_interest_auction transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Fill an interest auction
   */
  fill_interest_auction: (
    {
      auction_id,
      bidder,
      asset,
      fill_percent,
    }: { auction_id: u32; bidder: string; asset: string; fill_percent: i128 },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<Result<readonly [i128, i128]>>>;

  /**
   * Construct and simulate a get_collateral_factor transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get collateral factor for an RWA token
   */
  get_collateral_factor: (
    { rwa_token }: { rwa_token: string },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<u32>>;

  /**
   * Construct and simulate a set_collateral_factor transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Set collateral factor for a token
   * asset_type: Rwa for RWA tokens (uses RWA oracle), Crypto for stable/crypto tokens (uses Reflector oracle)
   * symbol: the asset symbol used for oracle queries (e.g. symbol_short!("USDC"))
   */
  set_collateral_factor: (
    {
      token,
      factor,
      asset_type,
      symbol,
    }: { token: string; factor: u32; asset_type: AssetType; symbol: string },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a calculate_borrow_limit transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Calculate borrow limit for a borrower
   */
  calculate_borrow_limit: (
    { borrower }: { borrower: string },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<Result<i128>>>;

  /**
   * Construct and simulate a set_backstop_take_rate transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Set backstop take rate
   */
  set_backstop_take_rate: (
    { take_rate }: { take_rate: u32 },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a set_backstop_threshold transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Set backstop threshold
   */
  set_backstop_threshold: (
    { threshold }: { threshold: i128 },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a withdraw_from_backstop transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Withdraw from backstop
   */
  withdraw_from_backstop: (
    { depositor, amount }: { depositor: string; amount: i128 },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<Result<void>>>;

  /**
   * Construct and simulate a calculate_health_factor transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Calculate health factor for a borrower (7 decimals)
   */
  calculate_health_factor: (
    { borrower }: { borrower: string },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<Result<u32>>>;

  /**
   * Construct and simulate a create_bad_debt_auction transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Create a bad debt auction for uncovered debt
   */
  create_bad_debt_auction: (
    { borrower, debt_asset }: { borrower: string; debt_asset: string },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<Result<u32>>>;

  /**
   * Construct and simulate a create_interest_auction transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Create an interest auction for accumulated protocol interest
   */
  create_interest_auction: (
    { asset }: { asset: string },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<Result<u32>>>;

  /**
   * Construct and simulate a get_accumulated_interest transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get accumulated interest for an asset
   */
  get_accumulated_interest: (
    { asset }: { asset: string },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<i128>>;

  /**
   * Construct and simulate a set_interest_rate_params transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Set interest rate parameters for an asset
   */
  set_interest_rate_params: (
    { asset, params }: { asset: string; params: InterestRateParams },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a set_liquidation_fee_rate transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Set liquidation fee rate (7 decimals, e.g. 100_000 = 1%). Admin-only.
   */
  set_liquidation_fee_rate: (
    { liquidation_fee_rate }: { liquidation_fee_rate: u32 },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a set_origination_fee_rate transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Set origination fee rate (7 decimals, e.g. 40_000 = 0.4%). Admin-only.
   */
  set_origination_fee_rate: (
    { origination_fee_rate }: { origination_fee_rate: u32 },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a can_create_interest_auction transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Check if an interest auction can be created
   */
  can_create_interest_auction: (
    { asset }: { asset: string },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<boolean>>;
}
export class Client extends ContractClient {
  static async deploy<T = Client>(
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy(null, options);
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([
        "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAALwAAAAAAAAANTm90QXV0aG9yaXplZAAAAAAAAAEAAAAAAAAADk5vdEluaXRpYWxpemVkAAAAAAACAAAAAAAAABJBbHJlYWR5SW5pdGlhbGl6ZWQAAAAAAAMAAAAAAAAAC05vdFBvc2l0aXZlAAAAAAQAAAAAAAAAD0FyaXRobWV0aWNFcnJvcgAAAAAFAAAAAAAAABVJbnZhbGlkTGVkZ2VyU2VxdWVuY2UAAAAAAAAGAAAAAAAAAApQb29sRnJvemVuAAAAAAAKAAAAAAAAAAlQb29sT25JY2UAAAAAAAALAAAAAAAAABdJbnN1ZmZpY2llbnRQb29sQmFsYW5jZQAAAAAMAAAAAAAAABVJbnN1ZmZpY2llbnRMaXF1aWRpdHkAAAAAAAANAAAAAAAAABlJbnN1ZmZpY2llbnRCVG9rZW5CYWxhbmNlAAAAAAAAFAAAAAAAAAAZSW5zdWZmaWNpZW50RGVwb3NpdEFtb3VudAAAAAAAABUAAAAAAAAAHUluc3VmZmljaWVudFdpdGhkcmF3YWxCYWxhbmNlAAAAAAAAFgAAAAAAAAAWSW5zdWZmaWNpZW50Q29sbGF0ZXJhbAAAAAAAHgAAAAAAAAAXSW5zdWZmaWNpZW50Qm9ycm93TGltaXQAAAAAHwAAAAAAAAATRGVidEFzc2V0QWxyZWFkeVNldAAAAAAgAAAAAAAAAA9EZWJ0QXNzZXROb3RTZXQAAAAAIQAAAAAAAAAVQ2Fubm90U3dpdGNoRGVidEFzc2V0AAAAAAAAIgAAAAAAAAAZSW5zdWZmaWNpZW50RFRva2VuQmFsYW5jZQAAAAAAACMAAAAAAAAAF0luc3VmZmljaWVudERlYnRUb1JlcGF5AAAAACQAAAAAAAAAEkNvbGxhdGVyYWxOb3RGb3VuZAAAAAAAKAAAAAAAAAAYQ29sbGF0ZXJhbEFtb3VudFRvb0xhcmdlAAAAKQAAAAAAAAAXSW52YWxpZENvbGxhdGVyYWxGYWN0b3IAAAAAKgAAAAAAAAAZSW52YWxpZEludGVyZXN0UmF0ZVBhcmFtcwAAAAAAADIAAAAAAAAAF0ludmFsaWRVdGlsaXphdGlvblJhdGlvAAAAADMAAAAAAAAAEFJhdGVBY2NydWFsRXJyb3IAAAA0AAAAAAAAAA9JbnZhbGlkVXRpbFJhdGUAAAAANQAAAAAAAAAPQ0RQTm90SW5zb2x2ZW50AAAAADwAAAAAAAAAD0F1Y3Rpb25Ob3RGb3VuZAAAAAA9AAAAAAAAABBBdWN0aW9uTm90QWN0aXZlAAAAPgAAAAAAAAAUQXVjdGlvbkFscmVhZHlGaWxsZWQAAAA/AAAAAAAAABhJbnZhbGlkTGlxdWlkYXRpb25BbW91bnQAAABAAAAAAAAAABNIZWFsdGhGYWN0b3JUb29IaWdoAAAAAEEAAAAAAAAAEkhlYWx0aEZhY3RvclRvb0xvdwAAAAAAQgAAAAAAAAASSW52YWxpZEZpbGxQZXJjZW50AAAAAABDAAAAAAAAABtJbnN1ZmZpY2llbnRCYWNrc3RvcERlcG9zaXQAAAAARgAAAAAAAAAVV2l0aGRyYXdhbFF1ZXVlQWN0aXZlAAAAAAAARwAAAAAAAAAZV2l0aGRyYXdhbFF1ZXVlTm90RXhwaXJlZAAAAAAAAEgAAAAAAAAAEUJhZERlYnROb3RDb3ZlcmVkAAAAAAAASQAAAAAAAAAXQmFja3N0b3BUaHJlc2hvbGROb3RNZXQAAAAASgAAAAAAAAAWT3JhY2xlUHJpY2VGZXRjaEZhaWxlZAAAAAAAUAAAAAAAAAAZT3JhY2xlRGVjaW1hbHNGZXRjaEZhaWxlZAAAAAAAAFEAAAAAAAAAEkludmFsaWRPcmFjbGVQcmljZQAAAAAAUgAAAAAAAAAVQXNzZXROb3RGb3VuZEluT3JhY2xlAAAAAAAAUwAAAAAAAAATVG9rZW5Db250cmFjdE5vdFNldAAAAABUAAAAAAAAAA5UcmVhc3VyeU5vdFNldAAAAAAAVQAAAAAAAAAXTm9UcmVhc3VyeUZlZXNUb0NvbGxlY3QAAAAAVg==",
        "AAAAAQAAAAAAAAAAAAAAA0NEUAAAAAAFAAAAMENvbGxhdGVyYWwgKFJXQSB0b2tlbnMpOiB0b2tlbiBhZGRyZXNzIC0+IGFtb3VudAAAAApjb2xsYXRlcmFsAAAAAAPsAAAAEwAAAAsAAAASQ3JlYXRpb24gdGltZXN0YW1wAAAAAAAKY3JlYXRlZF9hdAAAAAAABgAAAB1kVG9rZW5zIG9mIHRoZSBib3Jyb3dlZCBhc3NldAAAAAAAAAhkX3Rva2VucwAAAAsAAAAtRGVidCBhc3NldCBzeW1ib2wgKG9ubHkgb25lOiBVU0RDLCBYTE0sIGV0Yy4pAAAAAAAACmRlYnRfYXNzZXQAAAAAA+gAAAARAAAAFUxhc3QgdXBkYXRlIHRpbWVzdGFtcAAAAAAAAAtsYXN0X3VwZGF0ZQAAAAAG",
        "AAAAAgAAAJZEZXRlcm1pbmVzIHdoaWNoIG9yYWNsZSB0byB1c2UgZm9yIHByaWNlIHF1ZXJpZXMuCi0gQ3J5cHRvOiB1c2VzIHRoZSBSZWZsZWN0b3Igb3JhY2xlIChVU0RDLCBYTE0sIGV0Yy4pCi0gUndhOiB1c2VzIHRoZSBSV0Egb3JhY2xlIChVU0RZLCBDRVRFUywgZXRjLikAAAAAAAAAAAAJQXNzZXRUeXBlAAAAAAAAAgAAAAAAAAAAAAAABkNyeXB0bwAAAAAAAAAAAAAAAAADUndhAA==",
        "AAAAAgAAAAAAAAAAAAAACVBvb2xTdGF0ZQAAAAAAAAMAAAAAAAAAAAAAAAZBY3RpdmUAAAAAAAAAAAAAAAAABU9uSWNlAAAAAAAAAAAAAAAAAAAGRnJvemVuAAA=",
        "AAAAAQAAACpQcmljZSBkYXRhIGZyb20gb3JhY2xlIChTRVAtNDAgY29tcGF0aWJsZSkAAAAAAAAAAAAJUHJpY2VEYXRhAAAAAAAAAgAAAAAAAAAFcHJpY2UAAAAAAAALAAAAAAAAAAl0aW1lc3RhbXAAAAAAAAAG",
        "AAAAAQAAADxEdXRjaCBBdWN0aW9uIGRhdGEgc3RydWN0dXJlICh1bmlmaWVkIGZvciBhbGwgYXVjdGlvbiB0eXBlcykAAAAAAAAAC0F1Y3Rpb25EYXRhAAAAAAUAAAAPVHlwZSBvZiBhdWN0aW9uAAAAAAxhdWN0aW9uX3R5cGUAAAfQAAAAC0F1Y3Rpb25UeXBlAAAAAIxBc3NldHMvdG9rZW5zIGJlaW5nIGJpZCAod2hhdCBmaWxsZXIgcGF5cykKRm9yIFVzZXJMaXF1aWRhdGlvbjogZGVidCB0b2tlbnMKRm9yIEJhZERlYnQ6IHVuZGVybHlpbmcgZGVidCBhc3NldApGb3IgSW50ZXJlc3Q6IGJhY2tzdG9wIHRva2VucwAAAANiaWQAAAAD7AAAABMAAAALAAAAE0F1Y3Rpb24gc3RhcnQgYmxvY2sAAAAABWJsb2NrAAAAAAAABAAAAJZBc3NldHMvdG9rZW5zIGJlaW5nIGF1Y3Rpb25lZCAod2hhdCBmaWxsZXIgcmVjZWl2ZXMpCkZvciBVc2VyTGlxdWlkYXRpb246IGNvbGxhdGVyYWwgdG9rZW5zCkZvciBCYWREZWJ0OiBiYWNrc3RvcCB0b2tlbnMKRm9yIEludGVyZXN0OiBpbnRlcmVzdCB0b2tlbnMAAAAAAANsb3QAAAAD7AAAABMAAAALAAAArVRoZSB1c2VyIGFzc29jaWF0ZWQgd2l0aCB0aGlzIGF1Y3Rpb24KRm9yIFVzZXJMaXF1aWRhdGlvbjogdGhlIGJvcnJvd2VyIGJlaW5nIGxpcXVpZGF0ZWQKRm9yIEJhZERlYnQ6IHRoZSBib3Jyb3dlciB3aXRoIGJhZCBkZWJ0CkZvciBJbnRlcmVzdDogdGhlIGNvbnRyYWN0IGl0c2VsZiAocHJvdG9jb2wpAAAAAAAABHVzZXIAAAAT",
        "AAAAAwAAAA9UeXBlIG9mIGF1Y3Rpb24AAAAAAAAAAAtBdWN0aW9uVHlwZQAAAAADAAAAIkxpcXVpZGF0ZSB1bmhlYWx0aHkgdXNlciBwb3NpdGlvbnMAAAAAAA9Vc2VyTGlxdWlkYXRpb24AAAAAAAAAABtBdWN0aW9uIGJhY2tzdG9wJ3MgYmFkIGRlYnQAAAAAB0JhZERlYnQAAAAAAQAAACdEaXN0cmlidXRlIGFjY3J1ZWQgaW50ZXJlc3QgdG8gYmFja3N0b3AAAAAACEludGVyZXN0AAAAAg==",
        "AAAAAQAAAEdSZXNlcnZlIHN0YXRlIGRhdGEgZm9yIGFuIGFzc2V0ClRva2VuIHJhdGVzIHVzZSAxMiBkZWNpbWFscyAoU0NBTEFSXzEyKQAAAAAAAAAAC1Jlc2VydmVEYXRhAAAAAAgAAABdYlRva2VuIHRvIHVuZGVybHlpbmcgY29udmVyc2lvbiByYXRlICgxMiBkZWNpbWFscykKdW5kZXJseWluZyA9IGJfdG9rZW5zICogYl9yYXRlIC8gU0NBTEFSXzEyAAAAAAAABmJfcmF0ZQAAAAAACwAAABNUb3RhbCBiVG9rZW4gc3VwcGx5AAAAAAhiX3N1cHBseQAAAAsAAAAnSW50ZXJlc3Qgb3dlZCB0byBiYWNrc3RvcCAoYWNjdW11bGF0ZWQpAAAAAA9iYWNrc3RvcF9jcmVkaXQAAAAACwAAAF1kVG9rZW4gdG8gdW5kZXJseWluZyBjb252ZXJzaW9uIHJhdGUgKDEyIGRlY2ltYWxzKQp1bmRlcmx5aW5nID0gZF90b2tlbnMgKiBkX3JhdGUgLyBTQ0FMQVJfMTIAAAAAAAAGZF9yYXRlAAAAAAALAAAAE1RvdGFsIGRUb2tlbiBzdXBwbHkAAAAACGRfc3VwcGx5AAAACwAAAIpJbnRlcmVzdCByYXRlIG1vZGlmaWVyICg3IGRlY2ltYWxzKQpBZGp1c3RzIGR5bmFtaWNhbGx5IGJhc2VkIG9uIHV0aWxpemF0aW9uIHZzIHRhcmdldApSYW5nZTogU0NBTEFSXzcgLyAxMCB0byBTQ0FMQVJfNyAqIDEwICgwLjF4IHRvIDEweCkAAAAAAAZpcl9tb2QAAAAAAAsAAAAfTGFzdCBpbnRlcmVzdCBhY2NydWFsIHRpbWVzdGFtcAAAAAAJbGFzdF90aW1lAAAAAAAABgAAAEZGZWVzIG93ZWQgdG8gdHJlYXN1cnkgKGFjY3VtdWxhdGVkOiByZXNlcnZlIGZhY3RvciArIG9yaWdpbmF0aW9uIGZlZXMpAAAAAAAPdHJlYXN1cnlfY3JlZGl0AAAAAAs=",
        "AAAAAQAAABdCYWNrc3RvcCBkZXBvc2l0IHJlY29yZAAAAAAAAAAAD0JhY2tzdG9wRGVwb3NpdAAAAAAEAAAAK0RlcG9zaXQgYW1vdW50IChMUCB0b2tlbnMgb3IgbmF0aXZlIHRva2VucykAAAAABmFtb3VudAAAAAAACwAAABFEZXBvc2l0IHRpbWVzdGFtcAAAAAAAAAxkZXBvc2l0ZWRfYXQAAAAGAAAAG1doZXRoZXIgaW4gd2l0aGRyYXdhbCBxdWV1ZQAAAAATaW5fd2l0aGRyYXdhbF9xdWV1ZQAAAAABAAAAIVF1ZXVlIGVudHJ5IHRpbWVzdGFtcCAoaWYgcXVldWVkKQAAAAAAAAlxdWV1ZWRfYXQAAAAAAAPoAAAABg==",
        "AAAAAQAAAC9XaXRoZHJhd2FsIHJlcXVlc3QgKFF1ZXVlIGZvciBXaXRoZHJhd2FsIC0gUTRXKQAAAAAAAAAAEVdpdGhkcmF3YWxSZXF1ZXN0AAAAAAAAAwAAAAAAAAAHYWRkcmVzcwAAAAATAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAAAAAACXF1ZXVlZF9hdAAAAAAAAAY=",
        "AAAAAQAAAb1JbnRlcmVzdCByYXRlIHBhcmFtZXRlcnMgZm9yIGEgcmVzZXJ2ZQpBbGwgdmFsdWVzIGluIDcgZGVjaW1hbHMgKFNDQUxBUl83KQoKRXhhbXBsZSBjb25maWd1cmF0aW9uIGZvciBVU0RDOgpgYGAKSW50ZXJlc3RSYXRlUGFyYW1zIHsKdGFyZ2V0X3V0aWw6IDdfNTAwXzAwMCwgICAgLy8gNzUlCm1heF91dGlsOiA5XzUwMF8wMDAsICAgICAgIC8vIDk1JQpyX2Jhc2U6IDEwMF8wMDAsICAgICAgICAgICAvLyAxJSBiYXNlIHJhdGUKcl9vbmU6IDUwMF8wMDAsICAgICAgICAgICAgLy8gNSUgc2xvcGUgdG8gdGFyZ2V0CnJfdHdvOiA1XzAwMF8wMDAsICAgICAgICAgIC8vIDUwJSBzbG9wZSB0byBtYXgKcl90aHJlZTogMTVfMDAwXzAwMCwgICAgICAgLy8gMTUwJSBzbG9wZSBhYm92ZSBtYXgKcmVhY3Rpdml0eTogMjAwLCAgICAgICAgICAgLy8gMC4wMDAwMiByZWFjdGl2aXR5Cn0KYGBgAAAAAAAAAAAAABJJbnRlcmVzdFJhdGVQYXJhbXMAAAAAAAcAAABZTWF4aW11bSB1dGlsaXphdGlvbiByYXRlIGJlZm9yZSBleHRyZW1lIHJhdGVzIGtpY2sgaW4gKDcgZGVjaW1hbHMsIGUuZy4sIDlfNTAwXzAwMCA9IDk1JSkAAAAAAAAIbWF4X3V0aWwAAAAEAAAAMkJhc2UgaW50ZXJlc3QgcmF0ZSBSMCAoNyBkZWNpbWFscywgYWx3YXlzIGFwcGxpZWQpAAAAAAAGcl9iYXNlAAAAAAAEAAAAPkludGVyZXN0IHJhdGUgc2xvcGUgUjEgKDcgZGVjaW1hbHMsIGFwcGxpZWQgdXAgdG8gdGFyZ2V0X3V0aWwpAAAAAAAFcl9vbmUAAAAAAAAEAAAAO0ludGVyZXN0IHJhdGUgc2xvcGUgUjMgKDcgZGVjaW1hbHMsIGFwcGxpZWQgYWJvdmUgbWF4X3V0aWwpAAAAAAdyX3RocmVlAAAAAAQAAABJSW50ZXJlc3QgcmF0ZSBzbG9wZSBSMiAoNyBkZWNpbWFscywgYXBwbGllZCBmcm9tIHRhcmdldF91dGlsIHRvIG1heF91dGlsKQAAAAAAAAVyX3R3bwAAAAAAAAQAAAA9UmVhY3Rpdml0eSBjb25zdGFudCBmb3IgcmF0ZSBtb2RpZmllciBhZGp1c3RtZW50ICg3IGRlY2ltYWxzKQAAAAAAAApyZWFjdGl2aXR5AAAAAAAEAAAAO1RhcmdldCB1dGlsaXphdGlvbiByYXRlICg3IGRlY2ltYWxzLCBlLmcuLCA3XzUwMF8wMDAgPSA3NSUpAAAAAAt0YXJnZXRfdXRpbAAAAAAE",
        "AAAABQAAAAAAAAAAAAAAClJlcGF5RXZlbnQAAAAAAAEAAAALcmVwYXlfZXZlbnQAAAAABAAAAAAAAAAIYm9ycm93ZXIAAAATAAAAAAAAAAAAAAAFYXNzZXQAAAAAAAARAAAAAAAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAAAAAAAIZF90b2tlbnMAAAALAAAAAAAAAAI=",
        "AAAABQAAAAAAAAAAAAAAC0JvcnJvd0V2ZW50AAAAAAEAAAAMYm9ycm93X2V2ZW50AAAABAAAAAAAAAAIYm9ycm93ZXIAAAATAAAAAAAAAAAAAAAFYXNzZXQAAAAAAAARAAAAAAAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAAAAAAAIZF90b2tlbnMAAAALAAAAAAAAAAI=",
        "AAAABQAAACtFdmVudHMgZW1pdHRlZCBieSB0aGUgbGVuZGluZyBwb29sIGNvbnRyYWN0AAAAAAAAAAAMRGVwb3NpdEV2ZW50AAAAAQAAAA1kZXBvc2l0X2V2ZW50AAAAAAAABAAAAAAAAAAGbGVuZGVyAAAAAAATAAAAAAAAAAAAAAAFYXNzZXQAAAAAAAARAAAAAAAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAAAAAAAIYl90b2tlbnMAAAALAAAAAAAAAAI=",
        "AAAABQAAAAAAAAAAAAAADVdpdGhkcmF3RXZlbnQAAAAAAAABAAAADndpdGhkcmF3X2V2ZW50AAAAAAAEAAAAAAAAAAZsZW5kZXIAAAAAABMAAAAAAAAAAAAAAAVhc3NldAAAAAAAABEAAAAAAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAAAAAAAAAAAAhiX3Rva2VucwAAAAsAAAAAAAAAAg==",
        "AAAABQAAAAAAAAAAAAAAEkFkZENvbGxhdGVyYWxFdmVudAAAAAAAAQAAABRhZGRfY29sbGF0ZXJhbF9ldmVudAAAAAMAAAAAAAAACGJvcnJvd2VyAAAAEwAAAAAAAAAAAAAACXJ3YV90b2tlbgAAAAAAABMAAAAAAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAAAAAAAg==",
        "AAAABQAAAAAAAAAAAAAAE0xpcXVpZGF0aW9uRmVlRXZlbnQAAAAAAQAAABVsaXF1aWRhdGlvbl9mZWVfZXZlbnQAAAAAAAADAAAAAAAAAAlyd2FfdG9rZW4AAAAAAAATAAAAAAAAAAAAAAAKZmVlX2Ftb3VudAAAAAAACwAAAAAAAAAAAAAACHRyZWFzdXJ5AAAAEwAAAAAAAAAC",
        "AAAABQAAAAAAAAAAAAAAFEludGVyZXN0QWNjcnVlZEV2ZW50AAAAAQAAABZpbnRlcmVzdF9hY2NydWVkX2V2ZW50AAAAAAAEAAAAAAAAAAVhc3NldAAAAAAAABEAAAAAAAAAAAAAAAxiX3Rva2VuX3JhdGUAAAALAAAAAAAAAAAAAAAMZF90b2tlbl9yYXRlAAAACwAAAAAAAAAAAAAADXJhdGVfbW9kaWZpZXIAAAAAAAALAAAAAAAAAAI=",
        "AAAABQAAAAAAAAAAAAAAFVJlbW92ZUNvbGxhdGVyYWxFdmVudAAAAAAAAAEAAAAXcmVtb3ZlX2NvbGxhdGVyYWxfZXZlbnQAAAAAAwAAAAAAAAAIYm9ycm93ZXIAAAATAAAAAAAAAAAAAAAJcndhX3Rva2VuAAAAAAAAEwAAAAAAAAAAAAAABmFtb3VudAAAAAAACwAAAAAAAAAC",
        "AAAABQAAAAAAAAAAAAAAFkxpcXVpZGF0aW9uRmlsbGVkRXZlbnQAAAAAAAEAAAAYbGlxdWlkYXRpb25fZmlsbGVkX2V2ZW50AAAABAAAAAAAAAAKYXVjdGlvbl9pZAAAAAAABAAAAAAAAAAAAAAACmxpcXVpZGF0b3IAAAAAABMAAAAAAAAAAAAAABNjb2xsYXRlcmFsX3JlY2VpdmVkAAAAAAsAAAAAAAAAAAAAAAlkZWJ0X3BhaWQAAAAAAAALAAAAAAAAAAI=",
        "AAAABQAAAAAAAAAAAAAAGUJhZERlYnRBdWN0aW9uRmlsbGVkRXZlbnQAAAAAAAABAAAAHWJhZF9kZWJ0X2F1Y3Rpb25fZmlsbGVkX2V2ZW50AAAAAAAABAAAAAAAAAAKYXVjdGlvbl9pZAAAAAAABAAAAAAAAAAAAAAABmJpZGRlcgAAAAAAEwAAAAAAAAAAAAAADGRlYnRfY292ZXJlZAAAAAsAAAAAAAAAAAAAAA9iYWNrc3RvcF90b2tlbnMAAAAACwAAAAAAAAAC",
        "AAAABQAAAAAAAAAAAAAAGUxpcXVpZGF0aW9uSW5pdGlhdGVkRXZlbnQAAAAAAAABAAAAG2xpcXVpZGF0aW9uX2luaXRpYXRlZF9ldmVudAAAAAAGAAAAAAAAAAhib3Jyb3dlcgAAABMAAAAAAAAAAAAAAAlyd2FfdG9rZW4AAAAAAAATAAAAAAAAAAAAAAAKZGVidF9hc3NldAAAAAAAEQAAAAAAAAAAAAAAEWNvbGxhdGVyYWxfYW1vdW50AAAAAAAACwAAAAAAAAAAAAAAC2RlYnRfYW1vdW50AAAAAAsAAAAAAAAAAAAAAAphdWN0aW9uX2lkAAAAAAAEAAAAAAAAAAI=",
        "AAAABQAAAAAAAAAAAAAAGkJhZERlYnRBdWN0aW9uQ3JlYXRlZEV2ZW50AAAAAAABAAAAHmJhZF9kZWJ0X2F1Y3Rpb25fY3JlYXRlZF9ldmVudAAAAAAABAAAAAAAAAAKYXVjdGlvbl9pZAAAAAAABAAAAAAAAAAAAAAACGJvcnJvd2VyAAAAEwAAAAAAAAAAAAAACmRlYnRfYXNzZXQAAAAAABEAAAAAAAAAAAAAAAtkZWJ0X2Ftb3VudAAAAAALAAAAAAAAAAI=",
        "AAAABQAAAAAAAAAAAAAAGkludGVyZXN0QXVjdGlvbkZpbGxlZEV2ZW50AAAAAAABAAAAHWludGVyZXN0X2F1Y3Rpb25fZmlsbGVkX2V2ZW50AAAAAAAABQAAAAAAAAAKYXVjdGlvbl9pZAAAAAAABAAAAAAAAAAAAAAABmJpZGRlcgAAAAAAEwAAAAAAAAAAAAAABWFzc2V0AAAAAAAAEQAAAAAAAAAAAAAAEWludGVyZXN0X3JlY2VpdmVkAAAAAAAACwAAAAAAAAAAAAAADWJhY2tzdG9wX3BhaWQAAAAAAAALAAAAAAAAAAI=",
        "AAAABQAAAAAAAAAAAAAAGlRyZWFzdXJ5RmVlc0NvbGxlY3RlZEV2ZW50AAAAAAABAAAAHXRyZWFzdXJ5X2ZlZXNfY29sbGVjdGVkX2V2ZW50AAAAAAAAAwAAAAAAAAAFYXNzZXQAAAAAAAARAAAAAAAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAAAAAAAIdHJlYXN1cnkAAAATAAAAAAAAAAI=",
        "AAAABQAAAAAAAAAAAAAAG0ludGVyZXN0QXVjdGlvbkNyZWF0ZWRFdmVudAAAAAABAAAAHmludGVyZXN0X2F1Y3Rpb25fY3JlYXRlZF9ldmVudAAAAAAAAwAAAAAAAAAKYXVjdGlvbl9pZAAAAAAABAAAAAAAAAAAAAAABWFzc2V0AAAAAAAAEQAAAAAAAAAAAAAAD2ludGVyZXN0X2Ftb3VudAAAAAALAAAAAAAAAAI=",
        "AAAAAQAAABtNYWluIHBvb2wgc3RvcmFnZSBzdHJ1Y3R1cmUAAAAAAAAAAAtQb29sU3RvcmFnZQAAAAAaAAAAAAAAAAVhZG1pbgAAAAAAABMAAAAAAAAAC2Fzc2V0X3R5cGVzAAAAA+wAAAARAAAH0AAAAAlBc3NldFR5cGUAAAAAAAAAAAAADGF1Y3Rpb25fZGF0YQAAA+wAAAAEAAAH0AAAAAtBdWN0aW9uRGF0YQAAAAAAAAAAEGJfdG9rZW5fYmFsYW5jZXMAAAPsAAAAEwAAA+wAAAARAAAACwAAAAAAAAARYmFja3N0b3BfZGVwb3NpdHMAAAAAAAPsAAAAEwAAB9AAAAAPQmFja3N0b3BEZXBvc2l0AAAAAAAAAAASYmFja3N0b3BfdGFrZV9yYXRlAAAAAAAEAAAAAAAAABJiYWNrc3RvcF90aHJlc2hvbGQAAAAAAAsAAAAAAAAADmJhY2tzdG9wX3Rva2VuAAAAAAPoAAAAEwAAAAAAAAAOYmFja3N0b3BfdG90YWwAAAAAAAsAAAAAAAAACmNvbGxhdGVyYWwAAAAAA+wAAAATAAAD7AAAABMAAAALAAAAAAAAABZjb2xsYXRlcmFsX2Fzc2V0X3R5cGVzAAAAAAPsAAAAEwAAB9AAAAAJQXNzZXRUeXBlAAAAAAAAAAAAABJjb2xsYXRlcmFsX2ZhY3RvcnMAAAAAA+wAAAATAAAABAAAAAAAAAASY29sbGF0ZXJhbF9zeW1ib2xzAAAAAAPsAAAAEwAAABEAAAAAAAAAEGRfdG9rZW5fYmFsYW5jZXMAAAPsAAAAEwAAA+wAAAARAAAACwAAAAAAAAAUaW50ZXJlc3RfcmF0ZV9wYXJhbXMAAAPsAAAAEQAAB9AAAAASSW50ZXJlc3RSYXRlUGFyYW1zAAAAAAAAAAAAFGxpcXVpZGF0aW9uX2ZlZV9yYXRlAAAABAAAAAAAAAAUb3JpZ2luYXRpb25fZmVlX3JhdGUAAAAEAAAAAAAAAA1wb29sX2JhbGFuY2VzAAAAAAAD7AAAABEAAAALAAAAAAAAAApwb29sX3N0YXRlAAAAAAfQAAAACVBvb2xTdGF0ZQAAAAAAAAAAAAAQcmVmbGVjdG9yX29yYWNsZQAAABMAAAAAAAAADHJlc2VydmVfZGF0YQAAA+wAAAARAAAH0AAAAAtSZXNlcnZlRGF0YQAAAAAAAAAADnJlc2VydmVfZmFjdG9yAAAAAAAEAAAAAAAAAApyd2Ffb3JhY2xlAAAAAAATAAAAAAAAAA90b2tlbl9jb250cmFjdHMAAAAD7AAAABEAAAATAAAAAAAAAAh0cmVhc3VyeQAAABMAAAAAAAAAEHdpdGhkcmF3YWxfcXVldWUAAAPqAAAH0AAAABFXaXRoZHJhd2FsUmVxdWVzdAAAAA==",
        "AAAAAAAAAApSZXBheSBkZWJ0AAAAAAAFcmVwYXkAAAAAAAADAAAAAAAAAAhib3Jyb3dlcgAAABMAAAAAAAAABWFzc2V0AAAAAAAAEQAAAAAAAAAIZF90b2tlbnMAAAALAAAAAQAAA+kAAAALAAAAAw==",
        "AAAAAAAAACFCb3Jyb3cgY3J5cHRvIGFzc2V0IGZyb20gdGhlIHBvb2wAAAAAAAAGYm9ycm93AAAAAAADAAAAAAAAAAhib3Jyb3dlcgAAABMAAAAAAAAABWFzc2V0AAAAAAAAEQAAAAAAAAAGYW1vdW50AAAAAAALAAAAAQAAA+kAAAALAAAAAw==",
        "AAAAAAAAACBEZXBvc2l0IGNyeXB0byBhc3NldCB0byB0aGUgcG9vbAAAAAdkZXBvc2l0AAAAAAMAAAAAAAAABmxlbmRlcgAAAAAAEwAAAAAAAAAFYXNzZXQAAAAAAAARAAAAAAAAAAZhbW91bnQAAAAAAAsAAAABAAAD6QAAAAsAAAAD",
        "AAAAAAAAAE1VcGdyYWRlIHRoZSBjb250cmFjdCB0byBhIG5ldyBXQVNNIGhhc2gKT25seSB0aGUgYWRtaW4gY2FuIGNhbGwgdGhpcyBmdW5jdGlvbgAAAAAAAAd1cGdyYWRlAAAAAAEAAAAAAAAADW5ld193YXNtX2hhc2gAAAAAAAPuAAAAIAAAAAA=",
        "AAAAAAAAACNXaXRoZHJhdyBjcnlwdG8gYXNzZXQgZnJvbSB0aGUgcG9vbAAAAAAId2l0aGRyYXcAAAADAAAAAAAAAAZsZW5kZXIAAAAAABMAAAAAAAAABWFzc2V0AAAAAAAAEQAAAAAAAAAIYl90b2tlbnMAAAALAAAAAQAAA+kAAAALAAAAAw==",
        "AAAAAAAAABtJbml0aWFsaXplIHRoZSBsZW5kaW5nIHBvb2wAAAAACmluaXRpYWxpemUAAAAAAAkAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAIdHJlYXN1cnkAAAATAAAAAAAAAApyd2Ffb3JhY2xlAAAAAAATAAAAAAAAABByZWZsZWN0b3Jfb3JhY2xlAAAAEwAAAAAAAAASYmFja3N0b3BfdGhyZXNob2xkAAAAAAALAAAAAAAAABJiYWNrc3RvcF90YWtlX3JhdGUAAAAAAAQAAAAAAAAADnJlc2VydmVfZmFjdG9yAAAAAAAEAAAAAAAAABRvcmlnaW5hdGlvbl9mZWVfcmF0ZQAAAAQAAAAAAAAAFGxpcXVpZGF0aW9uX2ZlZV9yYXRlAAAABAAAAAA=",
        "AAAAAAAAABpGaWxsIGEgbGlxdWlkYXRpb24gYXVjdGlvbgAAAAAADGZpbGxfYXVjdGlvbgAAAAIAAAAAAAAACmF1Y3Rpb25faWQAAAAAAAQAAAAAAAAACmxpcXVpZGF0b3IAAAAAABMAAAABAAAD6QAAA+0AAAAAAAAAAw==",
        "AAAAAAAAABRHZXQgdHJlYXN1cnkgYWRkcmVzcwAAAAxnZXRfdHJlYXN1cnkAAAAAAAAAAQAAABM=",
        "AAAAAAAAACBDaGVjayBpZiBhIGJvcnJvd2VyIGhhcyBiYWQgZGVidAAAAAxoYXNfYmFkX2RlYnQAAAABAAAAAAAAAAhib3Jyb3dlcgAAABMAAAABAAAAAQ==",
        "AAAAAAAAACFTZXQgdHJlYXN1cnkgYWRkcmVzcy4gQWRtaW4tb25seS4AAAAAAAAMc2V0X3RyZWFzdXJ5AAAAAQAAAAAAAAAIdHJlYXN1cnkAAAATAAAAAA==",
        "AAAAAAAAABhBZGQgUldBIHRva2VuIGNvbGxhdGVyYWwAAAAOYWRkX2NvbGxhdGVyYWwAAAAAAAMAAAAAAAAACGJvcnJvd2VyAAAAEwAAAAAAAAAJcndhX3Rva2VuAAAAAAAAEwAAAAAAAAAGYW1vdW50AAAAAAALAAAAAQAAA+kAAAPtAAAAAAAAAAM=",
        "AAAAAAAAADJHZXQgY29sbGF0ZXJhbCBhbW91bnQgZm9yIGEgYm9ycm93ZXIgYW5kIFJXQSB0b2tlbgAAAAAADmdldF9jb2xsYXRlcmFsAAAAAAACAAAAAAAAAAhib3Jyb3dlcgAAABMAAAAAAAAACXJ3YV90b2tlbgAAAAAAABMAAAABAAAACw==",
        "AAAAAAAAAA5HZXQgcG9vbCBzdGF0ZQAAAAAADmdldF9wb29sX3N0YXRlAAAAAAAAAAAAAQAAB9AAAAAJUG9vbFN0YXRlAAAA",
        "AAAAAAAAAA5TZXQgcG9vbCBzdGF0ZQAAAAAADnNldF9wb29sX3N0YXRlAAAAAAABAAAAAAAAAAVzdGF0ZQAAAAAAB9AAAAAJUG9vbFN0YXRlAAAAAAAAAA==",
        "AAAAAAAAABxBY2NydWUgaW50ZXJlc3QgZm9yIGFuIGFzc2V0AAAAD2FjY3J1ZV9pbnRlcmVzdAAAAAABAAAAAAAAAAVhc3NldAAAAAAAABEAAAABAAAD6QAAA+0AAAAAAAAAAw==",
        "AAAAAAAAABtHZXQgYlRva2VuUmF0ZSBmb3IgYW4gYXNzZXQAAAAAEGdldF9iX3Rva2VuX3JhdGUAAAABAAAAAAAAAAVhc3NldAAAAAAAABEAAAABAAAACw==",
        "AAAAAAAAABtHZXQgZFRva2VuUmF0ZSBmb3IgYW4gYXNzZXQAAAAAEGdldF9kX3Rva2VuX3JhdGUAAAABAAAAAAAAAAVhc3NldAAAAAAAABEAAAABAAAACw==",
        "AAAAAAAAAB1HZXQgcG9vbCBiYWxhbmNlIGZvciBhbiBhc3NldAAAAAAAABBnZXRfcG9vbF9iYWxhbmNlAAAAAQAAAAAAAAAFYXNzZXQAAAAAAAARAAAAAQAAAAs=",
        "AAAAAAAAACZHZXQgY3VycmVudCBpbnRlcmVzdCByYXRlIGZvciBhbiBhc3NldAAAAAAAEWdldF9pbnRlcmVzdF9yYXRlAAAAAAAAAQAAAAAAAAAFYXNzZXQAAAAAAAARAAAAAQAAA+kAAAALAAAAAw==",
        "AAAAAAAAABtSZW1vdmUgUldBIHRva2VuIGNvbGxhdGVyYWwAAAAAEXJlbW92ZV9jb2xsYXRlcmFsAAAAAAAAAwAAAAAAAAAIYm9ycm93ZXIAAAATAAAAAAAAAAlyd2FfdG9rZW4AAAAAAAATAAAAAAAAAAZhbW91bnQAAAAAAAsAAAABAAAD6QAAA+0AAAAAAAAAAw==",
        "AAAAAAAAACRHZXQgdG90YWwgYlRva2VuIHN1cHBseSBmb3IgYW4gYXNzZXQAAAASZ2V0X2JfdG9rZW5fc3VwcGx5AAAAAAABAAAAAAAAAAVhc3NldAAAAAAAABEAAAABAAAACw==",
        "AAAAAAAAACNTZXQgYmFja3N0b3AgdG9rZW4gY29udHJhY3QgYWRkcmVzcwAAAAASc2V0X2JhY2tzdG9wX3Rva2VuAAAAAAABAAAAAAAAAA10b2tlbl9hZGRyZXNzAAAAAAAAEwAAAAA=",
        "AAAAAAAAAEJTZXQgcmVzZXJ2ZSBmYWN0b3IgKDcgZGVjaW1hbHMsIGUuZy4gMV8wMDBfMDAwID0gMTAlKS4gQWRtaW4tb25seS4AAAAAABJzZXRfcmVzZXJ2ZV9mYWN0b3IAAAAAAAEAAAAAAAAADnJlc2VydmVfZmFjdG9yAAAAAAAEAAAAAA==",
        "AAAAAAAAAJhTZXQgdG9rZW4gY29udHJhY3QgYWRkcmVzcyBmb3IgYW4gYXNzZXQgc3ltYm9sCmFzc2V0X3R5cGU6IFJ3YSBmb3IgUldBIHRva2VucyAodXNlcyBSV0Egb3JhY2xlKSwgQ3J5cHRvIGZvciBzdGFibGUvY3J5cHRvIHRva2VucyAodXNlcyBSZWZsZWN0b3Igb3JhY2xlKQAAABJzZXRfdG9rZW5fY29udHJhY3QAAAAAAAMAAAAAAAAABWFzc2V0AAAAAAAAEQAAAAAAAAANdG9rZW5fYWRkcmVzcwAAAAAAABMAAAAAAAAACmFzc2V0X3R5cGUAAAAAB9AAAAAJQXNzZXRUeXBlAAAAAAAAAA==",
        "AAAAAAAAABNEZXBvc2l0IHRvIGJhY2tzdG9wAAAAABNkZXBvc2l0X3RvX2JhY2tzdG9wAAAAAAIAAAAAAAAACWRlcG9zaXRvcgAAAAAAABMAAAAAAAAABmFtb3VudAAAAAAACwAAAAEAAAPpAAAD7QAAAAAAAAAD",
        "AAAAAAAAAB9HZXQgYlRva2VuIGJhbGFuY2UgZm9yIGEgbGVuZGVyAAAAABNnZXRfYl90b2tlbl9iYWxhbmNlAAAAAAIAAAAAAAAABmxlbmRlcgAAAAAAEwAAAAAAAAAFYXNzZXQAAAAAAAARAAAAAQAAAAs=",
        "AAAAAAAAACFHZXQgZFRva2VuIGJhbGFuY2UgZm9yIGEgYm9ycm93ZXIAAAAAAAATZ2V0X2RfdG9rZW5fYmFsYW5jZQAAAAACAAAAAAAAAAhib3Jyb3dlcgAAABMAAAAAAAAABWFzc2V0AAAAAAAAEQAAAAEAAAAL",
        "AAAAAAAAAD9HZXQgYWNjdW11bGF0ZWQgdHJlYXN1cnkgZmVlcyAobm90IHlldCBjb2xsZWN0ZWQpIGZvciBhbiBhc3NldC4AAAAAE2dldF90cmVhc3VyeV9jcmVkaXQAAAAAAQAAAAAAAAAFYXNzZXQAAAAAAAARAAAAAQAAAAs=",
        "AAAAAAAAACNJbml0aWF0ZSBsaXF1aWRhdGlvbiBmb3IgYSBib3Jyb3dlcgAAAAAUaW5pdGlhdGVfbGlxdWlkYXRpb24AAAAEAAAAAAAAAAhib3Jyb3dlcgAAABMAAAAAAAAACXJ3YV90b2tlbgAAAAAAABMAAAAAAAAACmRlYnRfYXNzZXQAAAAAABEAAAAAAAAAE2xpcXVpZGF0aW9uX3BlcmNlbnQAAAAABAAAAAEAAAPpAAAABAAAAAM=",
        "AAAAAAAAAFxDb2xsZWN0IGFjY3VtdWxhdGVkIHRyZWFzdXJ5IGZlZXMgZm9yIGFuIGFzc2V0IGFuZCB0cmFuc2ZlciB0byB0cmVhc3VyeSBhZGRyZXNzLiBBZG1pbi1vbmx5LgAAABVjb2xsZWN0X3RyZWFzdXJ5X2ZlZXMAAAAAAAABAAAAAAAAAAVhc3NldAAAAAAAABEAAAABAAAD6QAAAAsAAAAD",
        "AAAAAAAAABdGaWxsIGEgYmFkIGRlYnQgYXVjdGlvbgAAAAAVZmlsbF9iYWRfZGVidF9hdWN0aW9uAAAAAAAAAwAAAAAAAAAKYXVjdGlvbl9pZAAAAAAABAAAAAAAAAAGYmlkZGVyAAAAAAATAAAAAAAAAAZhbW91bnQAAAAAAAsAAAABAAAD6QAAAAsAAAAD",
        "AAAAAAAAABhGaWxsIGFuIGludGVyZXN0IGF1Y3Rpb24AAAAVZmlsbF9pbnRlcmVzdF9hdWN0aW9uAAAAAAAABAAAAAAAAAAKYXVjdGlvbl9pZAAAAAAABAAAAAAAAAAGYmlkZGVyAAAAAAATAAAAAAAAAAVhc3NldAAAAAAAABEAAAAAAAAADGZpbGxfcGVyY2VudAAAAAsAAAABAAAD6QAAA+0AAAACAAAACwAAAAsAAAAD",
        "AAAAAAAAACZHZXQgY29sbGF0ZXJhbCBmYWN0b3IgZm9yIGFuIFJXQSB0b2tlbgAAAAAAFWdldF9jb2xsYXRlcmFsX2ZhY3RvcgAAAAAAAAEAAAAAAAAACXJ3YV90b2tlbgAAAAAAABMAAAABAAAABA==",
        "AAAAAAAAANlTZXQgY29sbGF0ZXJhbCBmYWN0b3IgZm9yIGEgdG9rZW4KYXNzZXRfdHlwZTogUndhIGZvciBSV0EgdG9rZW5zICh1c2VzIFJXQSBvcmFjbGUpLCBDcnlwdG8gZm9yIHN0YWJsZS9jcnlwdG8gdG9rZW5zICh1c2VzIFJlZmxlY3RvciBvcmFjbGUpCnN5bWJvbDogdGhlIGFzc2V0IHN5bWJvbCB1c2VkIGZvciBvcmFjbGUgcXVlcmllcyAoZS5nLiBzeW1ib2xfc2hvcnQhKCJVU0RDIikpAAAAAAAAFXNldF9jb2xsYXRlcmFsX2ZhY3RvcgAAAAAAAAQAAAAAAAAABXRva2VuAAAAAAAAEwAAAAAAAAAGZmFjdG9yAAAAAAAEAAAAAAAAAAphc3NldF90eXBlAAAAAAfQAAAACUFzc2V0VHlwZQAAAAAAAAAAAAAGc3ltYm9sAAAAAAARAAAAAA==",
        "AAAAAAAAACVDYWxjdWxhdGUgYm9ycm93IGxpbWl0IGZvciBhIGJvcnJvd2VyAAAAAAAAFmNhbGN1bGF0ZV9ib3Jyb3dfbGltaXQAAAAAAAEAAAAAAAAACGJvcnJvd2VyAAAAEwAAAAEAAAPpAAAACwAAAAM=",
        "AAAAAAAAABZTZXQgYmFja3N0b3AgdGFrZSByYXRlAAAAAAAWc2V0X2JhY2tzdG9wX3Rha2VfcmF0ZQAAAAAAAQAAAAAAAAAJdGFrZV9yYXRlAAAAAAAABAAAAAA=",
        "AAAAAAAAABZTZXQgYmFja3N0b3AgdGhyZXNob2xkAAAAAAAWc2V0X2JhY2tzdG9wX3RocmVzaG9sZAAAAAAAAQAAAAAAAAAJdGhyZXNob2xkAAAAAAAACwAAAAA=",
        "AAAAAAAAABZXaXRoZHJhdyBmcm9tIGJhY2tzdG9wAAAAAAAWd2l0aGRyYXdfZnJvbV9iYWNrc3RvcAAAAAAAAgAAAAAAAAAJZGVwb3NpdG9yAAAAAAAAEwAAAAAAAAAGYW1vdW50AAAAAAALAAAAAQAAA+kAAAPtAAAAAAAAAAM=",
        "AAAAAAAAADNDYWxjdWxhdGUgaGVhbHRoIGZhY3RvciBmb3IgYSBib3Jyb3dlciAoNyBkZWNpbWFscykAAAAAF2NhbGN1bGF0ZV9oZWFsdGhfZmFjdG9yAAAAAAEAAAAAAAAACGJvcnJvd2VyAAAAEwAAAAEAAAPpAAAABAAAAAM=",
        "AAAAAAAAACxDcmVhdGUgYSBiYWQgZGVidCBhdWN0aW9uIGZvciB1bmNvdmVyZWQgZGVidAAAABdjcmVhdGVfYmFkX2RlYnRfYXVjdGlvbgAAAAACAAAAAAAAAAhib3Jyb3dlcgAAABMAAAAAAAAACmRlYnRfYXNzZXQAAAAAABEAAAABAAAD6QAAAAQAAAAD",
        "AAAAAAAAADxDcmVhdGUgYW4gaW50ZXJlc3QgYXVjdGlvbiBmb3IgYWNjdW11bGF0ZWQgcHJvdG9jb2wgaW50ZXJlc3QAAAAXY3JlYXRlX2ludGVyZXN0X2F1Y3Rpb24AAAAAAQAAAAAAAAAFYXNzZXQAAAAAAAARAAAAAQAAA+kAAAAEAAAAAw==",
        "AAAAAAAAACVHZXQgYWNjdW11bGF0ZWQgaW50ZXJlc3QgZm9yIGFuIGFzc2V0AAAAAAAAGGdldF9hY2N1bXVsYXRlZF9pbnRlcmVzdAAAAAEAAAAAAAAABWFzc2V0AAAAAAAAEQAAAAEAAAAL",
        "AAAAAAAAAClTZXQgaW50ZXJlc3QgcmF0ZSBwYXJhbWV0ZXJzIGZvciBhbiBhc3NldAAAAAAAABhzZXRfaW50ZXJlc3RfcmF0ZV9wYXJhbXMAAAACAAAAAAAAAAVhc3NldAAAAAAAABEAAAAAAAAABnBhcmFtcwAAAAAH0AAAABJJbnRlcmVzdFJhdGVQYXJhbXMAAAAAAAA=",
        "AAAAAAAAAEVTZXQgbGlxdWlkYXRpb24gZmVlIHJhdGUgKDcgZGVjaW1hbHMsIGUuZy4gMTAwXzAwMCA9IDElKS4gQWRtaW4tb25seS4AAAAAAAAYc2V0X2xpcXVpZGF0aW9uX2ZlZV9yYXRlAAAAAQAAAAAAAAAUbGlxdWlkYXRpb25fZmVlX3JhdGUAAAAEAAAAAA==",
        "AAAAAAAAAEZTZXQgb3JpZ2luYXRpb24gZmVlIHJhdGUgKDcgZGVjaW1hbHMsIGUuZy4gNDBfMDAwID0gMC40JSkuIEFkbWluLW9ubHkuAAAAAAAYc2V0X29yaWdpbmF0aW9uX2ZlZV9yYXRlAAAAAQAAAAAAAAAUb3JpZ2luYXRpb25fZmVlX3JhdGUAAAAEAAAAAA==",
        "AAAAAAAAACtDaGVjayBpZiBhbiBpbnRlcmVzdCBhdWN0aW9uIGNhbiBiZSBjcmVhdGVkAAAAABtjYW5fY3JlYXRlX2ludGVyZXN0X2F1Y3Rpb24AAAAAAQAAAAAAAAAFYXNzZXQAAAAAAAARAAAAAQAAAAE=",
      ]),
      options
    );
  }
  public readonly fromJSON = {
    repay: this.txFromJSON<Result<i128>>,
    borrow: this.txFromJSON<Result<i128>>,
    deposit: this.txFromJSON<Result<i128>>,
    upgrade: this.txFromJSON<null>,
    withdraw: this.txFromJSON<Result<i128>>,
    initialize: this.txFromJSON<null>,
    fill_auction: this.txFromJSON<Result<void>>,
    get_treasury: this.txFromJSON<string>,
    has_bad_debt: this.txFromJSON<boolean>,
    set_treasury: this.txFromJSON<null>,
    add_collateral: this.txFromJSON<Result<void>>,
    get_collateral: this.txFromJSON<i128>,
    get_pool_state: this.txFromJSON<PoolState>,
    set_pool_state: this.txFromJSON<null>,
    accrue_interest: this.txFromJSON<Result<void>>,
    get_b_token_rate: this.txFromJSON<i128>,
    get_d_token_rate: this.txFromJSON<i128>,
    get_pool_balance: this.txFromJSON<i128>,
    get_interest_rate: this.txFromJSON<Result<i128>>,
    remove_collateral: this.txFromJSON<Result<void>>,
    get_b_token_supply: this.txFromJSON<i128>,
    set_backstop_token: this.txFromJSON<null>,
    set_reserve_factor: this.txFromJSON<null>,
    set_token_contract: this.txFromJSON<null>,
    deposit_to_backstop: this.txFromJSON<Result<void>>,
    get_b_token_balance: this.txFromJSON<i128>,
    get_d_token_balance: this.txFromJSON<i128>,
    get_treasury_credit: this.txFromJSON<i128>,
    initiate_liquidation: this.txFromJSON<Result<u32>>,
    collect_treasury_fees: this.txFromJSON<Result<i128>>,
    fill_bad_debt_auction: this.txFromJSON<Result<i128>>,
    fill_interest_auction: this.txFromJSON<Result<readonly [i128, i128]>>,
    get_collateral_factor: this.txFromJSON<u32>,
    set_collateral_factor: this.txFromJSON<null>,
    calculate_borrow_limit: this.txFromJSON<Result<i128>>,
    set_backstop_take_rate: this.txFromJSON<null>,
    set_backstop_threshold: this.txFromJSON<null>,
    withdraw_from_backstop: this.txFromJSON<Result<void>>,
    calculate_health_factor: this.txFromJSON<Result<u32>>,
    create_bad_debt_auction: this.txFromJSON<Result<u32>>,
    create_interest_auction: this.txFromJSON<Result<u32>>,
    get_accumulated_interest: this.txFromJSON<i128>,
    set_interest_rate_params: this.txFromJSON<null>,
    set_liquidation_fee_rate: this.txFromJSON<null>,
    set_origination_fee_rate: this.txFromJSON<null>,
    can_create_interest_auction: this.txFromJSON<boolean>,
  };
}
