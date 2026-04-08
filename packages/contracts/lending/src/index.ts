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
    contractId: "CDTWMEFOCTZOYCOJMTFCDLKKZIDDH5ZUGVYWSIB3R3QCFFQO3VPO6O6Z",
    pool1ContractId: "CDTWMEFOCTZOYCOJMTFCDLKKZIDDH5ZUGVYWSIB3R3QCFFQO3VPO6O6Z",
    pool2ContractId: "CDZWW5XCWA6J3AHZJLN7VU5I5QMMZFUPYKIF3M6IOOWU23C25PXVRI37",
  },
} as const;

export const Errors = {
  1: {message:"NotAuthorized"},
  2: {message:"NotInitialized"},
  3: {message:"AlreadyInitialized"},
  4: {message:"NotPositive"},
  5: {message:"ArithmeticError"},
  6: {message:"InvalidLedgerSequence"},
  10: {message:"PoolFrozen"},
  11: {message:"PoolOnIce"},
  12: {message:"InsufficientPoolBalance"},
  14: {message:"ReserveDisabled"},
  15: {message:"SupplyCapExceeded"},
  20: {message:"InsufficientBTokenBalance"},
  30: {message:"InsufficientCollateral"},
  31: {message:"InsufficientBorrowLimit"},
  32: {message:"DebtAssetAlreadySet"},
  33: {message:"DebtAssetNotSet"},
  35: {message:"InsufficientDTokenBalance"},
  40: {message:"CollateralNotFound"},
  41: {message:"CollateralAmountTooLarge"},
  42: {message:"InvalidCollateralFactor"},
  50: {message:"InvalidInterestRateParams"},
  51: {message:"InvalidUtilizationRatio"},
  52: {message:"RateAccrualError"},
  53: {message:"InvalidUtilRate"},
  60: {message:"CDPNotInsolvent"},
  61: {message:"AuctionNotFound"},
  62: {message:"AuctionNotActive"},
  63: {message:"AuctionAlreadyFilled"},
  64: {message:"InvalidLiquidationAmount"},
  65: {message:"HealthFactorTooHigh"},
  66: {message:"HealthFactorTooLow"},
  67: {message:"InvalidFillPercent"},
  70: {message:"InsufficientBackstopDeposit"},
  71: {message:"WithdrawalQueueActive"},
  72: {message:"WithdrawalQueueNotExpired"},
  73: {message:"BadDebtNotCovered"},
  74: {message:"BackstopThresholdNotMet"},
  75: {message:"WithdrawalQueueFull"},
  80: {message:"OraclePriceFetchFailed"},
  81: {message:"OracleDecimalsFetchFailed"},
  82: {message:"InvalidOraclePrice"},
  83: {message:"AssetNotFoundInOracle"},
  84: {message:"TokenContractNotSet"},
  85: {message:"TreasuryNotSet"},
  86: {message:"NoTreasuryFeesToCollect"},
  87: {message:"ConfigNotUnlocked"},
  88: {message:"ConfigQueueNotFound"},
  89: {message:"ConfigAlreadyQueued"}
}


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
 * Typed storage keys for the lending pool.
 * 
 * Layout:
 * - Instance storage          : fixed-size scalar config (Admin, PoolState, fee rates, oracles)
 * - Persistent SHARED per-entry: per-asset config set by admin (CollateralFactor, TokenContract…)
 * and per-asset state (PoolBalance, ReserveData, InterestRateParams, Auction)
 * - Persistent USER per-entry : per-user positions (BTokenBalance, DTokenBalance, Cdp)
 */
export type DataKey = {tag: "Admin", values: void} | {tag: "PoolState", values: void} | {tag: "NekoOracle", values: void} | {tag: "ReflectorOracle", values: void} | {tag: "BackstopContract", values: void} | {tag: "BackstopToken", values: void} | {tag: "BackstopTakeRate", values: void} | {tag: "Treasury", values: void} | {tag: "ReserveFactor", values: void} | {tag: "OriginationFeeRate", values: void} | {tag: "LiquidationFeeRate", values: void} | {tag: "TokenContract", values: readonly [string]} | {tag: "AssetType", values: readonly [string]} | {tag: "CollateralAssetType", values: readonly [string]} | {tag: "CollateralSymbol", values: readonly [string]} | {tag: "CollateralFactor", values: readonly [string]} | {tag: "PoolBalance", values: readonly [string]} | {tag: "ReserveData", values: readonly [string]} | {tag: "InterestRateParams", values: readonly [string]} | {tag: "BTokenBalance", values: readonly [UserAssetKey]} | {tag: "DTokenBalance", values: readonly [UserAssetKey]} | {tag: "Cdp", values: readonly [string]} | {tag: "Auction", values: readonly [u32]} | {tag: "ProposedAdmin", values: void} | {tag: "QueuedReserveConfig", values: readonly [string]};

/**
 * Determines which oracle to use for price queries.
 * - Crypto: uses the Reflector oracle (USDC, XLM, etc.)
 * - Rwa: uses the RWA oracle (USDY, CETES, etc.)
 */
export type AssetType = {tag: "Crypto", values: void} | {tag: "Rwa", values: void};

export type PoolState = {tag: "Active", values: void} | {tag: "OnIce", values: void} | {tag: "Frozen", values: void};


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
 * Key for per-user per-asset data (bTokens, dTokens)
 */
export interface UserAssetKey {
  asset: string;
  user: string;
}


/**
 * Arguments for [`crate::contract::LendingContract::__constructor`] (factory `deploy_v2` + tests).
 */
export interface PoolInitConfig {
  admin: string;
  backstop_take_rate: u32;
  liquidation_fee_rate: u32;
  neko_oracle: string;
  origination_fee_rate: u32;
  reflector_oracle: string;
  reserve_factor: u32;
  treasury: string;
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
 * Whether this reserve accepts new deposits and borrows
 */
enabled: boolean;
  /**
 * Liability factor (7 decimals, e.g. 8_000_000 = 80%)
 * Applied to debt when computing health factor and borrow limits:
 * effective_debt = debt_usd * SCALAR_7 / l_factor
 * Lower l_factor → stricter (debt counts as larger). Default: SCALAR_7 (1.0 = no change).
 */
l_factor: u32;
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
 * Maximum underlying tokens the reserve can hold (0 = unlimited)
 */
supply_cap: i128;
  /**
 * Target utilization rate (7 decimals, e.g., 7_500_000 = 75%)
 */
target_util: u32;
}


/**
 * A queued change to a reserve's interest rate parameters.
 * Stored in temporary storage; applies only after unlock_time has passed.
 */
export interface QueuedReserveConfig {
  new_params: InterestRateParams;
  /**
 * Unix timestamp after which the change can be applied
 */
unlock_time: u64;
}





















export interface Client {
  /**
   * Construct and simulate a repay transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Repay debt
   */
  repay: ({borrower, asset, d_tokens}: {borrower: string, asset: string, d_tokens: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<i128>>>

  /**
   * Construct and simulate a borrow transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Borrow crypto asset from the pool
   */
  borrow: ({borrower, asset, amount}: {borrower: string, asset: string, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<i128>>>

  /**
   * Construct and simulate a deposit transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Deposit crypto asset to the pool
   */
  deposit: ({lender, asset, amount}: {lender: string, asset: string, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<i128>>>

  /**
   * Construct and simulate a upgrade transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Upgrade the contract to a new WASM hash
   * Only the admin can call this function
   */
  upgrade: ({new_wasm_hash}: {new_wasm_hash: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a withdraw transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Withdraw crypto asset from the pool
   */
  withdraw: ({lender, asset, b_tokens}: {lender: string, asset: string, b_tokens: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<i128>>>

  /**
   * Construct and simulate a accept_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Step 2 of admin transfer: proposed address accepts and becomes the new admin.
   */
  accept_admin: (options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a fill_auction transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Fill a liquidation auction
   */
  fill_auction: ({auction_id, liquidator}: {auction_id: u32, liquidator: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_treasury transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get treasury address
   */
  get_treasury: (options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a has_bad_debt transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Check if a borrower has bad debt
   */
  has_bad_debt: ({borrower}: {borrower: string}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a set_treasury transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Set treasury address. Admin-only.
   */
  set_treasury: ({treasury}: {treasury: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a propose_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Step 1 of admin transfer: current admin proposes a new admin address.
   * The proposal is stored in temporary storage and expires after 7 days.
   */
  propose_admin: ({proposed}: {proposed: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a add_collateral transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Add RWA token collateral
   */
  add_collateral: ({borrower, neko_token, amount}: {borrower: string, neko_token: string, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_collateral transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get collateral amount for a borrower and RWA token
   */
  get_collateral: ({borrower, neko_token}: {borrower: string, neko_token: string}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a get_pool_state transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get pool state
   */
  get_pool_state: (options?: MethodOptions) => Promise<AssembledTransaction<PoolState>>

  /**
   * Construct and simulate a set_pool_state transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Set pool state
   */
  set_pool_state: ({state}: {state: PoolState}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a accrue_interest transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Accrue interest for an asset
   */
  accrue_interest: ({asset}: {asset: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_b_token_rate transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get bTokenRate for an asset
   */
  get_b_token_rate: ({asset}: {asset: string}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a get_d_token_rate transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get dTokenRate for an asset
   */
  get_d_token_rate: ({asset}: {asset: string}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a get_pool_balance transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get pool balance for an asset
   */
  get_pool_balance: ({asset}: {asset: string}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a get_interest_rate transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get current interest rate for an asset
   */
  get_interest_rate: ({asset}: {asset: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<i128>>>

  /**
   * Construct and simulate a remove_collateral transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Remove RWA token collateral
   */
  remove_collateral: ({borrower, neko_token, amount}: {borrower: string, neko_token: string, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_b_token_supply transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get total bToken supply for an asset
   */
  get_b_token_supply: ({asset}: {asset: string}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a get_d_token_supply transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get total dToken supply for an asset
   */
  get_d_token_supply: ({asset}: {asset: string}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a set_backstop_token transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Set backstop token address (used by interest auctions). Admin-only.
   */
  set_backstop_token: ({token_address}: {token_address: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a set_reserve_factor transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Set reserve factor (7 decimals, e.g. 1_000_000 = 10%). Admin-only.
   */
  set_reserve_factor: ({reserve_factor}: {reserve_factor: u32}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a set_token_contract transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Set token contract address for an asset symbol
   * asset_type: Rwa for RWA tokens (uses RWA oracle), Crypto for stable/crypto tokens (uses Reflector oracle)
   */
  set_token_contract: ({asset, token_address, asset_type}: {asset: string, token_address: string, asset_type: AssetType}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a get_b_token_balance transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get bToken balance for a lender
   */
  get_b_token_balance: ({lender, asset}: {lender: string, asset: string}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a get_d_token_balance transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get dToken balance for a borrower
   */
  get_d_token_balance: ({borrower, asset}: {borrower: string, asset: string}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a get_treasury_credit transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get accumulated treasury fees (not yet collected) for an asset.
   */
  get_treasury_credit: ({asset}: {asset: string}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a initiate_liquidation transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Initiate liquidation for a borrower
   */
  initiate_liquidation: ({borrower, neko_token, debt_asset, liquidation_percent}: {borrower: string, neko_token: string, debt_asset: string, liquidation_percent: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<u32>>>

  /**
   * Construct and simulate a collect_treasury_fees transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Collect accumulated treasury fees for an asset and transfer to treasury address. Admin-only.
   */
  collect_treasury_fees: ({asset}: {asset: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<i128>>>

  /**
   * Construct and simulate a fill_bad_debt_auction transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Fill a bad debt auction
   */
  fill_bad_debt_auction: ({auction_id, bidder, amount}: {auction_id: u32, bidder: string, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<i128>>>

  /**
   * Construct and simulate a fill_interest_auction transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Fill an interest auction
   */
  fill_interest_auction: ({auction_id, bidder, asset, fill_percent}: {auction_id: u32, bidder: string, asset: string, fill_percent: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<readonly [i128, i128]>>>

  /**
   * Construct and simulate a get_collateral_factor transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get collateral factor for an RWA token
   */
  get_collateral_factor: ({neko_token}: {neko_token: string}, options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a set_backstop_contract transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Register the neko-backstop contract address. Admin-only.
   * After registration, the backstop can call update_pool_state_from_backstop.
   */
  set_backstop_contract: ({backstop}: {backstop: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a set_collateral_factor transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Set collateral factor for a token
   * asset_type: Rwa for RWA tokens (uses RWA oracle), Crypto for stable/crypto tokens (uses Reflector oracle)
   * symbol: the asset symbol used for oracle queries (e.g. symbol_short!("USDC"))
   */
  set_collateral_factor: ({token, factor, asset_type, symbol}: {token: string, factor: u32, asset_type: AssetType, symbol: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a calculate_borrow_limit transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Calculate borrow limit for a borrower
   */
  calculate_borrow_limit: ({borrower}: {borrower: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<i128>>>

  /**
   * Construct and simulate a set_backstop_take_rate transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Set backstop take rate
   */
  set_backstop_take_rate: ({take_rate}: {take_rate: u32}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a calculate_health_factor transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Calculate health factor for a borrower (7 decimals)
   */
  calculate_health_factor: ({borrower}: {borrower: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<u32>>>

  /**
   * Construct and simulate a create_bad_debt_auction transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Create a bad debt auction for uncovered debt
   */
  create_bad_debt_auction: ({borrower, debt_asset}: {borrower: string, debt_asset: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<u32>>>

  /**
   * Construct and simulate a create_interest_auction transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Create an interest auction for accumulated protocol interest
   */
  create_interest_auction: ({asset}: {asset: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<u32>>>

  /**
   * Construct and simulate a get_accumulated_interest transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get accumulated interest for an asset
   */
  get_accumulated_interest: ({asset}: {asset: string}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a queue_set_reserve_params transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Queue a change to reserve interest rate parameters (step 1).
   * 7-day timelock unless pool is OnIce.
   */
  queue_set_reserve_params: ({asset, params}: {asset: string, params: InterestRateParams}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a set_liquidation_fee_rate transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Set liquidation fee rate (7 decimals, e.g. 100_000 = 1%). Admin-only.
   */
  set_liquidation_fee_rate: ({liquidation_fee_rate}: {liquidation_fee_rate: u32}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a set_origination_fee_rate transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Set origination fee rate (7 decimals, e.g. 40_000 = 0.4%). Admin-only.
   */
  set_origination_fee_rate: ({origination_fee_rate}: {origination_fee_rate: u32}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a apply_queued_reserve_params transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Apply a queued reserve param change after the timelock expires (step 2).
   */
  apply_queued_reserve_params: ({asset}: {asset: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a can_create_interest_auction transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Check if an interest auction can be created
   */
  can_create_interest_auction: ({asset}: {asset: string}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a cancel_queued_reserve_params transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Cancel a queued reserve param change before it is applied.
   */
  cancel_queued_reserve_params: ({asset}: {asset: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a update_pool_state_from_backstop transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Accept a pool state update pushed by the registered backstop contract.
   * State ordinal: 0 = Active, 1 = OnIce, 2+ = Frozen.
   */
  update_pool_state_from_backstop: ({caller, state}: {caller: string, state: u32}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
        /** Constructor/Initialization Args for the contract's `__constructor` method */
        {config}: {config: PoolInitConfig},
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
    return ContractClient.deploy({config}, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAAMAAAAAAAAAANTm90QXV0aG9yaXplZAAAAAAAAAEAAAAAAAAADk5vdEluaXRpYWxpemVkAAAAAAACAAAAAAAAABJBbHJlYWR5SW5pdGlhbGl6ZWQAAAAAAAMAAAAAAAAAC05vdFBvc2l0aXZlAAAAAAQAAAAAAAAAD0FyaXRobWV0aWNFcnJvcgAAAAAFAAAAAAAAABVJbnZhbGlkTGVkZ2VyU2VxdWVuY2UAAAAAAAAGAAAAAAAAAApQb29sRnJvemVuAAAAAAAKAAAAAAAAAAlQb29sT25JY2UAAAAAAAALAAAAAAAAABdJbnN1ZmZpY2llbnRQb29sQmFsYW5jZQAAAAAMAAAAAAAAAA9SZXNlcnZlRGlzYWJsZWQAAAAADgAAAAAAAAARU3VwcGx5Q2FwRXhjZWVkZWQAAAAAAAAPAAAAAAAAABlJbnN1ZmZpY2llbnRCVG9rZW5CYWxhbmNlAAAAAAAAFAAAAAAAAAAWSW5zdWZmaWNpZW50Q29sbGF0ZXJhbAAAAAAAHgAAAAAAAAAXSW5zdWZmaWNpZW50Qm9ycm93TGltaXQAAAAAHwAAAAAAAAATRGVidEFzc2V0QWxyZWFkeVNldAAAAAAgAAAAAAAAAA9EZWJ0QXNzZXROb3RTZXQAAAAAIQAAAAAAAAAZSW5zdWZmaWNpZW50RFRva2VuQmFsYW5jZQAAAAAAACMAAAAAAAAAEkNvbGxhdGVyYWxOb3RGb3VuZAAAAAAAKAAAAAAAAAAYQ29sbGF0ZXJhbEFtb3VudFRvb0xhcmdlAAAAKQAAAAAAAAAXSW52YWxpZENvbGxhdGVyYWxGYWN0b3IAAAAAKgAAAAAAAAAZSW52YWxpZEludGVyZXN0UmF0ZVBhcmFtcwAAAAAAADIAAAAAAAAAF0ludmFsaWRVdGlsaXphdGlvblJhdGlvAAAAADMAAAAAAAAAEFJhdGVBY2NydWFsRXJyb3IAAAA0AAAAAAAAAA9JbnZhbGlkVXRpbFJhdGUAAAAANQAAAAAAAAAPQ0RQTm90SW5zb2x2ZW50AAAAADwAAAAAAAAAD0F1Y3Rpb25Ob3RGb3VuZAAAAAA9AAAAAAAAABBBdWN0aW9uTm90QWN0aXZlAAAAPgAAAAAAAAAUQXVjdGlvbkFscmVhZHlGaWxsZWQAAAA/AAAAAAAAABhJbnZhbGlkTGlxdWlkYXRpb25BbW91bnQAAABAAAAAAAAAABNIZWFsdGhGYWN0b3JUb29IaWdoAAAAAEEAAAAAAAAAEkhlYWx0aEZhY3RvclRvb0xvdwAAAAAAQgAAAAAAAAASSW52YWxpZEZpbGxQZXJjZW50AAAAAABDAAAAAAAAABtJbnN1ZmZpY2llbnRCYWNrc3RvcERlcG9zaXQAAAAARgAAAAAAAAAVV2l0aGRyYXdhbFF1ZXVlQWN0aXZlAAAAAAAARwAAAAAAAAAZV2l0aGRyYXdhbFF1ZXVlTm90RXhwaXJlZAAAAAAAAEgAAAAAAAAAEUJhZERlYnROb3RDb3ZlcmVkAAAAAAAASQAAAAAAAAAXQmFja3N0b3BUaHJlc2hvbGROb3RNZXQAAAAASgAAAAAAAAATV2l0aGRyYXdhbFF1ZXVlRnVsbAAAAABLAAAAAAAAABZPcmFjbGVQcmljZUZldGNoRmFpbGVkAAAAAABQAAAAAAAAABlPcmFjbGVEZWNpbWFsc0ZldGNoRmFpbGVkAAAAAAAAUQAAAAAAAAASSW52YWxpZE9yYWNsZVByaWNlAAAAAABSAAAAAAAAABVBc3NldE5vdEZvdW5kSW5PcmFjbGUAAAAAAABTAAAAAAAAABNUb2tlbkNvbnRyYWN0Tm90U2V0AAAAAFQAAAAAAAAADlRyZWFzdXJ5Tm90U2V0AAAAAABVAAAAAAAAABdOb1RyZWFzdXJ5RmVlc1RvQ29sbGVjdAAAAABWAAAAAAAAABFDb25maWdOb3RVbmxvY2tlZAAAAAAAAFcAAAAAAAAAE0NvbmZpZ1F1ZXVlTm90Rm91bmQAAAAAWAAAAAAAAAATQ29uZmlnQWxyZWFkeVF1ZXVlZAAAAABZ",
        "AAAAAQAAAAAAAAAAAAAAA0NEUAAAAAAFAAAAMENvbGxhdGVyYWwgKFJXQSB0b2tlbnMpOiB0b2tlbiBhZGRyZXNzIC0+IGFtb3VudAAAAApjb2xsYXRlcmFsAAAAAAPsAAAAEwAAAAsAAAASQ3JlYXRpb24gdGltZXN0YW1wAAAAAAAKY3JlYXRlZF9hdAAAAAAABgAAAB1kVG9rZW5zIG9mIHRoZSBib3Jyb3dlZCBhc3NldAAAAAAAAAhkX3Rva2VucwAAAAsAAAAtRGVidCBhc3NldCBzeW1ib2wgKG9ubHkgb25lOiBVU0RDLCBYTE0sIGV0Yy4pAAAAAAAACmRlYnRfYXNzZXQAAAAAA+gAAAARAAAAFUxhc3QgdXBkYXRlIHRpbWVzdGFtcAAAAAAAAAtsYXN0X3VwZGF0ZQAAAAAG",
        "AAAAAgAAAZJUeXBlZCBzdG9yYWdlIGtleXMgZm9yIHRoZSBsZW5kaW5nIHBvb2wuCgpMYXlvdXQ6Ci0gSW5zdGFuY2Ugc3RvcmFnZSAgICAgICAgICA6IGZpeGVkLXNpemUgc2NhbGFyIGNvbmZpZyAoQWRtaW4sIFBvb2xTdGF0ZSwgZmVlIHJhdGVzLCBvcmFjbGVzKQotIFBlcnNpc3RlbnQgU0hBUkVEIHBlci1lbnRyeTogcGVyLWFzc2V0IGNvbmZpZyBzZXQgYnkgYWRtaW4gKENvbGxhdGVyYWxGYWN0b3IsIFRva2VuQ29udHJhY3TigKYpCmFuZCBwZXItYXNzZXQgc3RhdGUgKFBvb2xCYWxhbmNlLCBSZXNlcnZlRGF0YSwgSW50ZXJlc3RSYXRlUGFyYW1zLCBBdWN0aW9uKQotIFBlcnNpc3RlbnQgVVNFUiBwZXItZW50cnkgOiBwZXItdXNlciBwb3NpdGlvbnMgKEJUb2tlbkJhbGFuY2UsIERUb2tlbkJhbGFuY2UsIENkcCkAAAAAAAAAAAAHRGF0YUtleQAAAAAZAAAAAAAAAAAAAAAFQWRtaW4AAAAAAAAAAAAAAAAAAAlQb29sU3RhdGUAAAAAAAAAAAAAAAAAAApOZWtvT3JhY2xlAAAAAAAAAAAAAAAAAA9SZWZsZWN0b3JPcmFjbGUAAAAAAAAAAAAAAAAQQmFja3N0b3BDb250cmFjdAAAAAAAAAAAAAAADUJhY2tzdG9wVG9rZW4AAAAAAAAAAAAAAAAAABBCYWNrc3RvcFRha2VSYXRlAAAAAAAAAAAAAAAIVHJlYXN1cnkAAAAAAAAAAAAAAA1SZXNlcnZlRmFjdG9yAAAAAAAAAAAAAAAAAAAST3JpZ2luYXRpb25GZWVSYXRlAAAAAAAAAAAAAAAAABJMaXF1aWRhdGlvbkZlZVJhdGUAAAAAAAEAAAAAAAAADVRva2VuQ29udHJhY3QAAAAAAAABAAAAEQAAAAEAAAAAAAAACUFzc2V0VHlwZQAAAAAAAAEAAAARAAAAAQAAAAAAAAATQ29sbGF0ZXJhbEFzc2V0VHlwZQAAAAABAAAAEwAAAAEAAAAAAAAAEENvbGxhdGVyYWxTeW1ib2wAAAABAAAAEwAAAAEAAAAAAAAAEENvbGxhdGVyYWxGYWN0b3IAAAABAAAAEwAAAAEAAAAAAAAAC1Bvb2xCYWxhbmNlAAAAAAEAAAARAAAAAQAAAAAAAAALUmVzZXJ2ZURhdGEAAAAAAQAAABEAAAABAAAAAAAAABJJbnRlcmVzdFJhdGVQYXJhbXMAAAAAAAEAAAARAAAAAQAAAAAAAAANQlRva2VuQmFsYW5jZQAAAAAAAAEAAAfQAAAADFVzZXJBc3NldEtleQAAAAEAAAAAAAAADURUb2tlbkJhbGFuY2UAAAAAAAABAAAH0AAAAAxVc2VyQXNzZXRLZXkAAAABAAAAAAAAAANDZHAAAAAAAQAAABMAAAABAAAAAAAAAAdBdWN0aW9uAAAAAAEAAAAEAAAAAAAAAAAAAAANUHJvcG9zZWRBZG1pbgAAAAAAAAEAAAAAAAAAE1F1ZXVlZFJlc2VydmVDb25maWcAAAAAAQAAABE=",
        "AAAAAgAAAJZEZXRlcm1pbmVzIHdoaWNoIG9yYWNsZSB0byB1c2UgZm9yIHByaWNlIHF1ZXJpZXMuCi0gQ3J5cHRvOiB1c2VzIHRoZSBSZWZsZWN0b3Igb3JhY2xlIChVU0RDLCBYTE0sIGV0Yy4pCi0gUndhOiB1c2VzIHRoZSBSV0Egb3JhY2xlIChVU0RZLCBDRVRFUywgZXRjLikAAAAAAAAAAAAJQXNzZXRUeXBlAAAAAAAAAgAAAAAAAAAAAAAABkNyeXB0bwAAAAAAAAAAAAAAAAADUndhAA==",
        "AAAAAgAAAAAAAAAAAAAACVBvb2xTdGF0ZQAAAAAAAAMAAAAAAAAAAAAAAAZBY3RpdmUAAAAAAAAAAAAAAAAABU9uSWNlAAAAAAAAAAAAAAAAAAAGRnJvemVuAAA=",
        "AAAAAQAAACpQcmljZSBkYXRhIGZyb20gb3JhY2xlIChTRVAtNDAgY29tcGF0aWJsZSkAAAAAAAAAAAAJUHJpY2VEYXRhAAAAAAAAAgAAAAAAAAAFcHJpY2UAAAAAAAALAAAAAAAAAAl0aW1lc3RhbXAAAAAAAAAG",
        "AAAAAQAAADxEdXRjaCBBdWN0aW9uIGRhdGEgc3RydWN0dXJlICh1bmlmaWVkIGZvciBhbGwgYXVjdGlvbiB0eXBlcykAAAAAAAAAC0F1Y3Rpb25EYXRhAAAAAAUAAAAPVHlwZSBvZiBhdWN0aW9uAAAAAAxhdWN0aW9uX3R5cGUAAAfQAAAAC0F1Y3Rpb25UeXBlAAAAAIxBc3NldHMvdG9rZW5zIGJlaW5nIGJpZCAod2hhdCBmaWxsZXIgcGF5cykKRm9yIFVzZXJMaXF1aWRhdGlvbjogZGVidCB0b2tlbnMKRm9yIEJhZERlYnQ6IHVuZGVybHlpbmcgZGVidCBhc3NldApGb3IgSW50ZXJlc3Q6IGJhY2tzdG9wIHRva2VucwAAAANiaWQAAAAD7AAAABMAAAALAAAAE0F1Y3Rpb24gc3RhcnQgYmxvY2sAAAAABWJsb2NrAAAAAAAABAAAAJZBc3NldHMvdG9rZW5zIGJlaW5nIGF1Y3Rpb25lZCAod2hhdCBmaWxsZXIgcmVjZWl2ZXMpCkZvciBVc2VyTGlxdWlkYXRpb246IGNvbGxhdGVyYWwgdG9rZW5zCkZvciBCYWREZWJ0OiBiYWNrc3RvcCB0b2tlbnMKRm9yIEludGVyZXN0OiBpbnRlcmVzdCB0b2tlbnMAAAAAAANsb3QAAAAD7AAAABMAAAALAAAArVRoZSB1c2VyIGFzc29jaWF0ZWQgd2l0aCB0aGlzIGF1Y3Rpb24KRm9yIFVzZXJMaXF1aWRhdGlvbjogdGhlIGJvcnJvd2VyIGJlaW5nIGxpcXVpZGF0ZWQKRm9yIEJhZERlYnQ6IHRoZSBib3Jyb3dlciB3aXRoIGJhZCBkZWJ0CkZvciBJbnRlcmVzdDogdGhlIGNvbnRyYWN0IGl0c2VsZiAocHJvdG9jb2wpAAAAAAAABHVzZXIAAAAT",
        "AAAAAwAAAA9UeXBlIG9mIGF1Y3Rpb24AAAAAAAAAAAtBdWN0aW9uVHlwZQAAAAADAAAAIkxpcXVpZGF0ZSB1bmhlYWx0aHkgdXNlciBwb3NpdGlvbnMAAAAAAA9Vc2VyTGlxdWlkYXRpb24AAAAAAAAAABtBdWN0aW9uIGJhY2tzdG9wJ3MgYmFkIGRlYnQAAAAAB0JhZERlYnQAAAAAAQAAACdEaXN0cmlidXRlIGFjY3J1ZWQgaW50ZXJlc3QgdG8gYmFja3N0b3AAAAAACEludGVyZXN0AAAAAg==",
        "AAAAAQAAAEdSZXNlcnZlIHN0YXRlIGRhdGEgZm9yIGFuIGFzc2V0ClRva2VuIHJhdGVzIHVzZSAxMiBkZWNpbWFscyAoU0NBTEFSXzEyKQAAAAAAAAAAC1Jlc2VydmVEYXRhAAAAAAgAAABdYlRva2VuIHRvIHVuZGVybHlpbmcgY29udmVyc2lvbiByYXRlICgxMiBkZWNpbWFscykKdW5kZXJseWluZyA9IGJfdG9rZW5zICogYl9yYXRlIC8gU0NBTEFSXzEyAAAAAAAABmJfcmF0ZQAAAAAACwAAABNUb3RhbCBiVG9rZW4gc3VwcGx5AAAAAAhiX3N1cHBseQAAAAsAAAAnSW50ZXJlc3Qgb3dlZCB0byBiYWNrc3RvcCAoYWNjdW11bGF0ZWQpAAAAAA9iYWNrc3RvcF9jcmVkaXQAAAAACwAAAF1kVG9rZW4gdG8gdW5kZXJseWluZyBjb252ZXJzaW9uIHJhdGUgKDEyIGRlY2ltYWxzKQp1bmRlcmx5aW5nID0gZF90b2tlbnMgKiBkX3JhdGUgLyBTQ0FMQVJfMTIAAAAAAAAGZF9yYXRlAAAAAAALAAAAE1RvdGFsIGRUb2tlbiBzdXBwbHkAAAAACGRfc3VwcGx5AAAACwAAAIpJbnRlcmVzdCByYXRlIG1vZGlmaWVyICg3IGRlY2ltYWxzKQpBZGp1c3RzIGR5bmFtaWNhbGx5IGJhc2VkIG9uIHV0aWxpemF0aW9uIHZzIHRhcmdldApSYW5nZTogU0NBTEFSXzcgLyAxMCB0byBTQ0FMQVJfNyAqIDEwICgwLjF4IHRvIDEweCkAAAAAAAZpcl9tb2QAAAAAAAsAAAAfTGFzdCBpbnRlcmVzdCBhY2NydWFsIHRpbWVzdGFtcAAAAAAJbGFzdF90aW1lAAAAAAAABgAAAEZGZWVzIG93ZWQgdG8gdHJlYXN1cnkgKGFjY3VtdWxhdGVkOiByZXNlcnZlIGZhY3RvciArIG9yaWdpbmF0aW9uIGZlZXMpAAAAAAAPdHJlYXN1cnlfY3JlZGl0AAAAAAs=",
        "AAAAAQAAADJLZXkgZm9yIHBlci11c2VyIHBlci1hc3NldCBkYXRhIChiVG9rZW5zLCBkVG9rZW5zKQAAAAAAAAAAAAxVc2VyQXNzZXRLZXkAAAACAAAAAAAAAAVhc3NldAAAAAAAABEAAAAAAAAABHVzZXIAAAAT",
        "AAAAAQAAAGBBcmd1bWVudHMgZm9yIFtgY3JhdGU6OmNvbnRyYWN0OjpMZW5kaW5nQ29udHJhY3Q6Ol9fY29uc3RydWN0b3JgXSAoZmFjdG9yeSBgZGVwbG95X3YyYCArIHRlc3RzKS4AAAAAAAAADlBvb2xJbml0Q29uZmlnAAAAAAAIAAAAAAAAAAVhZG1pbgAAAAAAABMAAAAAAAAAEmJhY2tzdG9wX3Rha2VfcmF0ZQAAAAAABAAAAAAAAAAUbGlxdWlkYXRpb25fZmVlX3JhdGUAAAAEAAAAAAAAAAtuZWtvX29yYWNsZQAAAAATAAAAAAAAABRvcmlnaW5hdGlvbl9mZWVfcmF0ZQAAAAQAAAAAAAAAEHJlZmxlY3Rvcl9vcmFjbGUAAAATAAAAAAAAAA5yZXNlcnZlX2ZhY3RvcgAAAAAABAAAAAAAAAAIdHJlYXN1cnkAAAAT",
        "AAAAAQAAAb1JbnRlcmVzdCByYXRlIHBhcmFtZXRlcnMgZm9yIGEgcmVzZXJ2ZQpBbGwgdmFsdWVzIGluIDcgZGVjaW1hbHMgKFNDQUxBUl83KQoKRXhhbXBsZSBjb25maWd1cmF0aW9uIGZvciBVU0RDOgpgYGAKSW50ZXJlc3RSYXRlUGFyYW1zIHsKdGFyZ2V0X3V0aWw6IDdfNTAwXzAwMCwgICAgLy8gNzUlCm1heF91dGlsOiA5XzUwMF8wMDAsICAgICAgIC8vIDk1JQpyX2Jhc2U6IDEwMF8wMDAsICAgICAgICAgICAvLyAxJSBiYXNlIHJhdGUKcl9vbmU6IDUwMF8wMDAsICAgICAgICAgICAgLy8gNSUgc2xvcGUgdG8gdGFyZ2V0CnJfdHdvOiA1XzAwMF8wMDAsICAgICAgICAgIC8vIDUwJSBzbG9wZSB0byBtYXgKcl90aHJlZTogMTVfMDAwXzAwMCwgICAgICAgLy8gMTUwJSBzbG9wZSBhYm92ZSBtYXgKcmVhY3Rpdml0eTogMjAwLCAgICAgICAgICAgLy8gMC4wMDAwMiByZWFjdGl2aXR5Cn0KYGBgAAAAAAAAAAAAABJJbnRlcmVzdFJhdGVQYXJhbXMAAAAAAAoAAAA1V2hldGhlciB0aGlzIHJlc2VydmUgYWNjZXB0cyBuZXcgZGVwb3NpdHMgYW5kIGJvcnJvd3MAAAAAAAAHZW5hYmxlZAAAAAABAAAA/UxpYWJpbGl0eSBmYWN0b3IgKDcgZGVjaW1hbHMsIGUuZy4gOF8wMDBfMDAwID0gODAlKQpBcHBsaWVkIHRvIGRlYnQgd2hlbiBjb21wdXRpbmcgaGVhbHRoIGZhY3RvciBhbmQgYm9ycm93IGxpbWl0czoKZWZmZWN0aXZlX2RlYnQgPSBkZWJ0X3VzZCAqIFNDQUxBUl83IC8gbF9mYWN0b3IKTG93ZXIgbF9mYWN0b3Ig4oaSIHN0cmljdGVyIChkZWJ0IGNvdW50cyBhcyBsYXJnZXIpLiBEZWZhdWx0OiBTQ0FMQVJfNyAoMS4wID0gbm8gY2hhbmdlKS4AAAAAAAAIbF9mYWN0b3IAAAAEAAAAWU1heGltdW0gdXRpbGl6YXRpb24gcmF0ZSBiZWZvcmUgZXh0cmVtZSByYXRlcyBraWNrIGluICg3IGRlY2ltYWxzLCBlLmcuLCA5XzUwMF8wMDAgPSA5NSUpAAAAAAAACG1heF91dGlsAAAABAAAADJCYXNlIGludGVyZXN0IHJhdGUgUjAgKDcgZGVjaW1hbHMsIGFsd2F5cyBhcHBsaWVkKQAAAAAABnJfYmFzZQAAAAAABAAAAD5JbnRlcmVzdCByYXRlIHNsb3BlIFIxICg3IGRlY2ltYWxzLCBhcHBsaWVkIHVwIHRvIHRhcmdldF91dGlsKQAAAAAABXJfb25lAAAAAAAABAAAADtJbnRlcmVzdCByYXRlIHNsb3BlIFIzICg3IGRlY2ltYWxzLCBhcHBsaWVkIGFib3ZlIG1heF91dGlsKQAAAAAHcl90aHJlZQAAAAAEAAAASUludGVyZXN0IHJhdGUgc2xvcGUgUjIgKDcgZGVjaW1hbHMsIGFwcGxpZWQgZnJvbSB0YXJnZXRfdXRpbCB0byBtYXhfdXRpbCkAAAAAAAAFcl90d28AAAAAAAAEAAAAPVJlYWN0aXZpdHkgY29uc3RhbnQgZm9yIHJhdGUgbW9kaWZpZXIgYWRqdXN0bWVudCAoNyBkZWNpbWFscykAAAAAAAAKcmVhY3Rpdml0eQAAAAAABAAAAD5NYXhpbXVtIHVuZGVybHlpbmcgdG9rZW5zIHRoZSByZXNlcnZlIGNhbiBob2xkICgwID0gdW5saW1pdGVkKQAAAAAACnN1cHBseV9jYXAAAAAAAAsAAAA7VGFyZ2V0IHV0aWxpemF0aW9uIHJhdGUgKDcgZGVjaW1hbHMsIGUuZy4sIDdfNTAwXzAwMCA9IDc1JSkAAAAAC3RhcmdldF91dGlsAAAAAAQ=",
        "AAAAAQAAAIBBIHF1ZXVlZCBjaGFuZ2UgdG8gYSByZXNlcnZlJ3MgaW50ZXJlc3QgcmF0ZSBwYXJhbWV0ZXJzLgpTdG9yZWQgaW4gdGVtcG9yYXJ5IHN0b3JhZ2U7IGFwcGxpZXMgb25seSBhZnRlciB1bmxvY2tfdGltZSBoYXMgcGFzc2VkLgAAAAAAAAATUXVldWVkUmVzZXJ2ZUNvbmZpZwAAAAACAAAAAAAAAApuZXdfcGFyYW1zAAAAAAfQAAAAEkludGVyZXN0UmF0ZVBhcmFtcwAAAAAANFVuaXggdGltZXN0YW1wIGFmdGVyIHdoaWNoIHRoZSBjaGFuZ2UgY2FuIGJlIGFwcGxpZWQAAAALdW5sb2NrX3RpbWUAAAAABg==",
        "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",
        "AAAABQAAAAAAAAAAAAAAGlRyZWFzdXJ5RmVlc0NvbGxlY3RlZEV2ZW50AAAAAAABAAAAHXRyZWFzdXJ5X2ZlZXNfY29sbGVjdGVkX2V2ZW50AAAAAAAAAwAAAAAAAAAFYXNzZXQAAAAAAAARAAAAAAAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAAAAAAAIdHJlYXN1cnkAAAATAAAAAAAAAAI=",
        "AAAABQAAAAAAAAAAAAAAG0ludGVyZXN0QXVjdGlvbkNyZWF0ZWRFdmVudAAAAAABAAAAHmludGVyZXN0X2F1Y3Rpb25fY3JlYXRlZF9ldmVudAAAAAAAAwAAAAAAAAAKYXVjdGlvbl9pZAAAAAAABAAAAAAAAAAAAAAABWFzc2V0AAAAAAAAEQAAAAAAAAAAAAAAD2ludGVyZXN0X2Ftb3VudAAAAAALAAAAAAAAAAI=",
        "AAAABQAAAAAAAAAAAAAAG1Jlc2VydmVDb25maWdDYW5jZWxsZWRFdmVudAAAAAABAAAAHnJlc2VydmVfY29uZmlnX2NhbmNlbGxlZF9ldmVudAAAAAAAAQAAAAAAAAAFYXNzZXQAAAAAAAARAAAAAAAAAAI=",
        "AAAAAAAAAApSZXBheSBkZWJ0AAAAAAAFcmVwYXkAAAAAAAADAAAAAAAAAAhib3Jyb3dlcgAAABMAAAAAAAAABWFzc2V0AAAAAAAAEQAAAAAAAAAIZF90b2tlbnMAAAALAAAAAQAAA+kAAAALAAAAAw==",
        "AAAAAAAAACFCb3Jyb3cgY3J5cHRvIGFzc2V0IGZyb20gdGhlIHBvb2wAAAAAAAAGYm9ycm93AAAAAAADAAAAAAAAAAhib3Jyb3dlcgAAABMAAAAAAAAABWFzc2V0AAAAAAAAEQAAAAAAAAAGYW1vdW50AAAAAAALAAAAAQAAA+kAAAALAAAAAw==",
        "AAAAAAAAACBEZXBvc2l0IGNyeXB0byBhc3NldCB0byB0aGUgcG9vbAAAAAdkZXBvc2l0AAAAAAMAAAAAAAAABmxlbmRlcgAAAAAAEwAAAAAAAAAFYXNzZXQAAAAAAAARAAAAAAAAAAZhbW91bnQAAAAAAAsAAAABAAAD6QAAAAsAAAAD",
        "AAAAAAAAAE1VcGdyYWRlIHRoZSBjb250cmFjdCB0byBhIG5ldyBXQVNNIGhhc2gKT25seSB0aGUgYWRtaW4gY2FuIGNhbGwgdGhpcyBmdW5jdGlvbgAAAAAAAAd1cGdyYWRlAAAAAAEAAAAAAAAADW5ld193YXNtX2hhc2gAAAAAAAPuAAAAIAAAAAA=",
        "AAAAAAAAACNXaXRoZHJhdyBjcnlwdG8gYXNzZXQgZnJvbSB0aGUgcG9vbAAAAAAId2l0aGRyYXcAAAADAAAAAAAAAAZsZW5kZXIAAAAAABMAAAAAAAAABWFzc2V0AAAAAAAAEQAAAAAAAAAIYl90b2tlbnMAAAALAAAAAQAAA+kAAAALAAAAAw==",
        "AAAAAAAAAE1TdGVwIDIgb2YgYWRtaW4gdHJhbnNmZXI6IHByb3Bvc2VkIGFkZHJlc3MgYWNjZXB0cyBhbmQgYmVjb21lcyB0aGUgbmV3IGFkbWluLgAAAAAAAAxhY2NlcHRfYWRtaW4AAAAAAAAAAA==",
        "AAAAAAAAABpGaWxsIGEgbGlxdWlkYXRpb24gYXVjdGlvbgAAAAAADGZpbGxfYXVjdGlvbgAAAAIAAAAAAAAACmF1Y3Rpb25faWQAAAAAAAQAAAAAAAAACmxpcXVpZGF0b3IAAAAAABMAAAABAAAD6QAAAAIAAAAD",
        "AAAAAAAAABRHZXQgdHJlYXN1cnkgYWRkcmVzcwAAAAxnZXRfdHJlYXN1cnkAAAAAAAAAAQAAABM=",
        "AAAAAAAAACBDaGVjayBpZiBhIGJvcnJvd2VyIGhhcyBiYWQgZGVidAAAAAxoYXNfYmFkX2RlYnQAAAABAAAAAAAAAAhib3Jyb3dlcgAAABMAAAABAAAAAQ==",
        "AAAAAAAAACFTZXQgdHJlYXN1cnkgYWRkcmVzcy4gQWRtaW4tb25seS4AAAAAAAAMc2V0X3RyZWFzdXJ5AAAAAQAAAAAAAAAIdHJlYXN1cnkAAAATAAAAAA==",
        "AAAAAAAAAFtPbmUtdGltZSBzZXR1cCBhdCBkZXBsb3kgKGByZWdpc3RlcmAgd2l0aCBhcmdzIGluIHRlc3RzIC8gYGRlcGxveV92MmAgZnJvbSBgbmVrby1mYWN0b3J5YCkuAAAAAA1fX2NvbnN0cnVjdG9yAAAAAAAAAQAAAAAAAAAGY29uZmlnAAAAAAfQAAAADlBvb2xJbml0Q29uZmlnAAAAAAAA",
        "AAAAAAAAAItTdGVwIDEgb2YgYWRtaW4gdHJhbnNmZXI6IGN1cnJlbnQgYWRtaW4gcHJvcG9zZXMgYSBuZXcgYWRtaW4gYWRkcmVzcy4KVGhlIHByb3Bvc2FsIGlzIHN0b3JlZCBpbiB0ZW1wb3Jhcnkgc3RvcmFnZSBhbmQgZXhwaXJlcyBhZnRlciA3IGRheXMuAAAAAA1wcm9wb3NlX2FkbWluAAAAAAAAAQAAAAAAAAAIcHJvcG9zZWQAAAATAAAAAA==",
        "AAAAAAAAABhBZGQgUldBIHRva2VuIGNvbGxhdGVyYWwAAAAOYWRkX2NvbGxhdGVyYWwAAAAAAAMAAAAAAAAACGJvcnJvd2VyAAAAEwAAAAAAAAAKbmVrb190b2tlbgAAAAAAEwAAAAAAAAAGYW1vdW50AAAAAAALAAAAAQAAA+kAAAACAAAAAw==",
        "AAAAAAAAADJHZXQgY29sbGF0ZXJhbCBhbW91bnQgZm9yIGEgYm9ycm93ZXIgYW5kIFJXQSB0b2tlbgAAAAAADmdldF9jb2xsYXRlcmFsAAAAAAACAAAAAAAAAAhib3Jyb3dlcgAAABMAAAAAAAAACm5la29fdG9rZW4AAAAAABMAAAABAAAACw==",
        "AAAAAAAAAA5HZXQgcG9vbCBzdGF0ZQAAAAAADmdldF9wb29sX3N0YXRlAAAAAAAAAAAAAQAAB9AAAAAJUG9vbFN0YXRlAAAA",
        "AAAAAAAAAA5TZXQgcG9vbCBzdGF0ZQAAAAAADnNldF9wb29sX3N0YXRlAAAAAAABAAAAAAAAAAVzdGF0ZQAAAAAAB9AAAAAJUG9vbFN0YXRlAAAAAAAAAA==",
        "AAAAAAAAABxBY2NydWUgaW50ZXJlc3QgZm9yIGFuIGFzc2V0AAAAD2FjY3J1ZV9pbnRlcmVzdAAAAAABAAAAAAAAAAVhc3NldAAAAAAAABEAAAABAAAD6QAAAAIAAAAD",
        "AAAAAAAAABtHZXQgYlRva2VuUmF0ZSBmb3IgYW4gYXNzZXQAAAAAEGdldF9iX3Rva2VuX3JhdGUAAAABAAAAAAAAAAVhc3NldAAAAAAAABEAAAABAAAACw==",
        "AAAAAAAAABtHZXQgZFRva2VuUmF0ZSBmb3IgYW4gYXNzZXQAAAAAEGdldF9kX3Rva2VuX3JhdGUAAAABAAAAAAAAAAVhc3NldAAAAAAAABEAAAABAAAACw==",
        "AAAAAAAAAB1HZXQgcG9vbCBiYWxhbmNlIGZvciBhbiBhc3NldAAAAAAAABBnZXRfcG9vbF9iYWxhbmNlAAAAAQAAAAAAAAAFYXNzZXQAAAAAAAARAAAAAQAAAAs=",
        "AAAAAAAAACZHZXQgY3VycmVudCBpbnRlcmVzdCByYXRlIGZvciBhbiBhc3NldAAAAAAAEWdldF9pbnRlcmVzdF9yYXRlAAAAAAAAAQAAAAAAAAAFYXNzZXQAAAAAAAARAAAAAQAAA+kAAAALAAAAAw==",
        "AAAAAAAAABtSZW1vdmUgUldBIHRva2VuIGNvbGxhdGVyYWwAAAAAEXJlbW92ZV9jb2xsYXRlcmFsAAAAAAAAAwAAAAAAAAAIYm9ycm93ZXIAAAATAAAAAAAAAApuZWtvX3Rva2VuAAAAAAATAAAAAAAAAAZhbW91bnQAAAAAAAsAAAABAAAD6QAAAAIAAAAD",
        "AAAAAAAAACRHZXQgdG90YWwgYlRva2VuIHN1cHBseSBmb3IgYW4gYXNzZXQAAAASZ2V0X2JfdG9rZW5fc3VwcGx5AAAAAAABAAAAAAAAAAVhc3NldAAAAAAAABEAAAABAAAACw==",
        "AAAAAAAAACRHZXQgdG90YWwgZFRva2VuIHN1cHBseSBmb3IgYW4gYXNzZXQAAAASZ2V0X2RfdG9rZW5fc3VwcGx5AAAAAAABAAAAAAAAAAVhc3NldAAAAAAAABEAAAABAAAACw==",
        "AAAAAAAAAENTZXQgYmFja3N0b3AgdG9rZW4gYWRkcmVzcyAodXNlZCBieSBpbnRlcmVzdCBhdWN0aW9ucykuIEFkbWluLW9ubHkuAAAAABJzZXRfYmFja3N0b3BfdG9rZW4AAAAAAAEAAAAAAAAADXRva2VuX2FkZHJlc3MAAAAAAAATAAAAAA==",
        "AAAAAAAAAEJTZXQgcmVzZXJ2ZSBmYWN0b3IgKDcgZGVjaW1hbHMsIGUuZy4gMV8wMDBfMDAwID0gMTAlKS4gQWRtaW4tb25seS4AAAAAABJzZXRfcmVzZXJ2ZV9mYWN0b3IAAAAAAAEAAAAAAAAADnJlc2VydmVfZmFjdG9yAAAAAAAEAAAAAA==",
        "AAAAAAAAAJhTZXQgdG9rZW4gY29udHJhY3QgYWRkcmVzcyBmb3IgYW4gYXNzZXQgc3ltYm9sCmFzc2V0X3R5cGU6IFJ3YSBmb3IgUldBIHRva2VucyAodXNlcyBSV0Egb3JhY2xlKSwgQ3J5cHRvIGZvciBzdGFibGUvY3J5cHRvIHRva2VucyAodXNlcyBSZWZsZWN0b3Igb3JhY2xlKQAAABJzZXRfdG9rZW5fY29udHJhY3QAAAAAAAMAAAAAAAAABWFzc2V0AAAAAAAAEQAAAAAAAAANdG9rZW5fYWRkcmVzcwAAAAAAABMAAAAAAAAACmFzc2V0X3R5cGUAAAAAB9AAAAAJQXNzZXRUeXBlAAAAAAAAAA==",
        "AAAAAAAAAB9HZXQgYlRva2VuIGJhbGFuY2UgZm9yIGEgbGVuZGVyAAAAABNnZXRfYl90b2tlbl9iYWxhbmNlAAAAAAIAAAAAAAAABmxlbmRlcgAAAAAAEwAAAAAAAAAFYXNzZXQAAAAAAAARAAAAAQAAAAs=",
        "AAAAAAAAACFHZXQgZFRva2VuIGJhbGFuY2UgZm9yIGEgYm9ycm93ZXIAAAAAAAATZ2V0X2RfdG9rZW5fYmFsYW5jZQAAAAACAAAAAAAAAAhib3Jyb3dlcgAAABMAAAAAAAAABWFzc2V0AAAAAAAAEQAAAAEAAAAL",
        "AAAAAAAAAD9HZXQgYWNjdW11bGF0ZWQgdHJlYXN1cnkgZmVlcyAobm90IHlldCBjb2xsZWN0ZWQpIGZvciBhbiBhc3NldC4AAAAAE2dldF90cmVhc3VyeV9jcmVkaXQAAAAAAQAAAAAAAAAFYXNzZXQAAAAAAAARAAAAAQAAAAs=",
        "AAAAAAAAACNJbml0aWF0ZSBsaXF1aWRhdGlvbiBmb3IgYSBib3Jyb3dlcgAAAAAUaW5pdGlhdGVfbGlxdWlkYXRpb24AAAAEAAAAAAAAAAhib3Jyb3dlcgAAABMAAAAAAAAACm5la29fdG9rZW4AAAAAABMAAAAAAAAACmRlYnRfYXNzZXQAAAAAABEAAAAAAAAAE2xpcXVpZGF0aW9uX3BlcmNlbnQAAAAABAAAAAEAAAPpAAAABAAAAAM=",
        "AAAAAAAAAFxDb2xsZWN0IGFjY3VtdWxhdGVkIHRyZWFzdXJ5IGZlZXMgZm9yIGFuIGFzc2V0IGFuZCB0cmFuc2ZlciB0byB0cmVhc3VyeSBhZGRyZXNzLiBBZG1pbi1vbmx5LgAAABVjb2xsZWN0X3RyZWFzdXJ5X2ZlZXMAAAAAAAABAAAAAAAAAAVhc3NldAAAAAAAABEAAAABAAAD6QAAAAsAAAAD",
        "AAAAAAAAABdGaWxsIGEgYmFkIGRlYnQgYXVjdGlvbgAAAAAVZmlsbF9iYWRfZGVidF9hdWN0aW9uAAAAAAAAAwAAAAAAAAAKYXVjdGlvbl9pZAAAAAAABAAAAAAAAAAGYmlkZGVyAAAAAAATAAAAAAAAAAZhbW91bnQAAAAAAAsAAAABAAAD6QAAAAsAAAAD",
        "AAAAAAAAABhGaWxsIGFuIGludGVyZXN0IGF1Y3Rpb24AAAAVZmlsbF9pbnRlcmVzdF9hdWN0aW9uAAAAAAAABAAAAAAAAAAKYXVjdGlvbl9pZAAAAAAABAAAAAAAAAAGYmlkZGVyAAAAAAATAAAAAAAAAAVhc3NldAAAAAAAABEAAAAAAAAADGZpbGxfcGVyY2VudAAAAAsAAAABAAAD6QAAA+0AAAACAAAACwAAAAsAAAAD",
        "AAAAAAAAACZHZXQgY29sbGF0ZXJhbCBmYWN0b3IgZm9yIGFuIFJXQSB0b2tlbgAAAAAAFWdldF9jb2xsYXRlcmFsX2ZhY3RvcgAAAAAAAAEAAAAAAAAACm5la29fdG9rZW4AAAAAABMAAAABAAAABA==",
        "AAAAAAAAAINSZWdpc3RlciB0aGUgbmVrby1iYWNrc3RvcCBjb250cmFjdCBhZGRyZXNzLiBBZG1pbi1vbmx5LgpBZnRlciByZWdpc3RyYXRpb24sIHRoZSBiYWNrc3RvcCBjYW4gY2FsbCB1cGRhdGVfcG9vbF9zdGF0ZV9mcm9tX2JhY2tzdG9wLgAAAAAVc2V0X2JhY2tzdG9wX2NvbnRyYWN0AAAAAAAAAQAAAAAAAAAIYmFja3N0b3AAAAATAAAAAA==",
        "AAAAAAAAANlTZXQgY29sbGF0ZXJhbCBmYWN0b3IgZm9yIGEgdG9rZW4KYXNzZXRfdHlwZTogUndhIGZvciBSV0EgdG9rZW5zICh1c2VzIFJXQSBvcmFjbGUpLCBDcnlwdG8gZm9yIHN0YWJsZS9jcnlwdG8gdG9rZW5zICh1c2VzIFJlZmxlY3RvciBvcmFjbGUpCnN5bWJvbDogdGhlIGFzc2V0IHN5bWJvbCB1c2VkIGZvciBvcmFjbGUgcXVlcmllcyAoZS5nLiBzeW1ib2xfc2hvcnQhKCJVU0RDIikpAAAAAAAAFXNldF9jb2xsYXRlcmFsX2ZhY3RvcgAAAAAAAAQAAAAAAAAABXRva2VuAAAAAAAAEwAAAAAAAAAGZmFjdG9yAAAAAAAEAAAAAAAAAAphc3NldF90eXBlAAAAAAfQAAAACUFzc2V0VHlwZQAAAAAAAAAAAAAGc3ltYm9sAAAAAAARAAAAAA==",
        "AAAAAAAAACVDYWxjdWxhdGUgYm9ycm93IGxpbWl0IGZvciBhIGJvcnJvd2VyAAAAAAAAFmNhbGN1bGF0ZV9ib3Jyb3dfbGltaXQAAAAAAAEAAAAAAAAACGJvcnJvd2VyAAAAEwAAAAEAAAPpAAAACwAAAAM=",
        "AAAAAAAAABZTZXQgYmFja3N0b3AgdGFrZSByYXRlAAAAAAAWc2V0X2JhY2tzdG9wX3Rha2VfcmF0ZQAAAAAAAQAAAAAAAAAJdGFrZV9yYXRlAAAAAAAABAAAAAA=",
        "AAAAAAAAADNDYWxjdWxhdGUgaGVhbHRoIGZhY3RvciBmb3IgYSBib3Jyb3dlciAoNyBkZWNpbWFscykAAAAAF2NhbGN1bGF0ZV9oZWFsdGhfZmFjdG9yAAAAAAEAAAAAAAAACGJvcnJvd2VyAAAAEwAAAAEAAAPpAAAABAAAAAM=",
        "AAAAAAAAACxDcmVhdGUgYSBiYWQgZGVidCBhdWN0aW9uIGZvciB1bmNvdmVyZWQgZGVidAAAABdjcmVhdGVfYmFkX2RlYnRfYXVjdGlvbgAAAAACAAAAAAAAAAhib3Jyb3dlcgAAABMAAAAAAAAACmRlYnRfYXNzZXQAAAAAABEAAAABAAAD6QAAAAQAAAAD",
        "AAAAAAAAADxDcmVhdGUgYW4gaW50ZXJlc3QgYXVjdGlvbiBmb3IgYWNjdW11bGF0ZWQgcHJvdG9jb2wgaW50ZXJlc3QAAAAXY3JlYXRlX2ludGVyZXN0X2F1Y3Rpb24AAAAAAQAAAAAAAAAFYXNzZXQAAAAAAAARAAAAAQAAA+kAAAAEAAAAAw==",
        "AAAAAAAAACVHZXQgYWNjdW11bGF0ZWQgaW50ZXJlc3QgZm9yIGFuIGFzc2V0AAAAAAAAGGdldF9hY2N1bXVsYXRlZF9pbnRlcmVzdAAAAAEAAAAAAAAABWFzc2V0AAAAAAAAEQAAAAEAAAAL",
        "AAAAAAAAAGFRdWV1ZSBhIGNoYW5nZSB0byByZXNlcnZlIGludGVyZXN0IHJhdGUgcGFyYW1ldGVycyAoc3RlcCAxKS4KNy1kYXkgdGltZWxvY2sgdW5sZXNzIHBvb2wgaXMgT25JY2UuAAAAAAAAGHF1ZXVlX3NldF9yZXNlcnZlX3BhcmFtcwAAAAIAAAAAAAAABWFzc2V0AAAAAAAAEQAAAAAAAAAGcGFyYW1zAAAAAAfQAAAAEkludGVyZXN0UmF0ZVBhcmFtcwAAAAAAAA==",
        "AAAAAAAAAEVTZXQgbGlxdWlkYXRpb24gZmVlIHJhdGUgKDcgZGVjaW1hbHMsIGUuZy4gMTAwXzAwMCA9IDElKS4gQWRtaW4tb25seS4AAAAAAAAYc2V0X2xpcXVpZGF0aW9uX2ZlZV9yYXRlAAAAAQAAAAAAAAAUbGlxdWlkYXRpb25fZmVlX3JhdGUAAAAEAAAAAA==",
        "AAAAAAAAAEZTZXQgb3JpZ2luYXRpb24gZmVlIHJhdGUgKDcgZGVjaW1hbHMsIGUuZy4gNDBfMDAwID0gMC40JSkuIEFkbWluLW9ubHkuAAAAAAAYc2V0X29yaWdpbmF0aW9uX2ZlZV9yYXRlAAAAAQAAAAAAAAAUb3JpZ2luYXRpb25fZmVlX3JhdGUAAAAEAAAAAA==",
        "AAAAAAAAAEhBcHBseSBhIHF1ZXVlZCByZXNlcnZlIHBhcmFtIGNoYW5nZSBhZnRlciB0aGUgdGltZWxvY2sgZXhwaXJlcyAoc3RlcCAyKS4AAAAbYXBwbHlfcXVldWVkX3Jlc2VydmVfcGFyYW1zAAAAAAEAAAAAAAAABWFzc2V0AAAAAAAAEQAAAAA=",
        "AAAAAAAAACtDaGVjayBpZiBhbiBpbnRlcmVzdCBhdWN0aW9uIGNhbiBiZSBjcmVhdGVkAAAAABtjYW5fY3JlYXRlX2ludGVyZXN0X2F1Y3Rpb24AAAAAAQAAAAAAAAAFYXNzZXQAAAAAAAARAAAAAQAAAAE=",
        "AAAAAAAAADpDYW5jZWwgYSBxdWV1ZWQgcmVzZXJ2ZSBwYXJhbSBjaGFuZ2UgYmVmb3JlIGl0IGlzIGFwcGxpZWQuAAAAAAAcY2FuY2VsX3F1ZXVlZF9yZXNlcnZlX3BhcmFtcwAAAAEAAAAAAAAABWFzc2V0AAAAAAAAEQAAAAA=",
        "AAAAAAAAAHlBY2NlcHQgYSBwb29sIHN0YXRlIHVwZGF0ZSBwdXNoZWQgYnkgdGhlIHJlZ2lzdGVyZWQgYmFja3N0b3AgY29udHJhY3QuClN0YXRlIG9yZGluYWw6IDAgPSBBY3RpdmUsIDEgPSBPbkljZSwgMisgPSBGcm96ZW4uAAAAAAAAH3VwZGF0ZV9wb29sX3N0YXRlX2Zyb21fYmFja3N0b3AAAAAAAgAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAAVzdGF0ZQAAAAAAAAQAAAAA" ]),
      options
    )
  }
  public readonly fromJSON = {
    repay: this.txFromJSON<Result<i128>>,
        borrow: this.txFromJSON<Result<i128>>,
        deposit: this.txFromJSON<Result<i128>>,
        upgrade: this.txFromJSON<null>,
        withdraw: this.txFromJSON<Result<i128>>,
        accept_admin: this.txFromJSON<null>,
        fill_auction: this.txFromJSON<Result<void>>,
        get_treasury: this.txFromJSON<string>,
        has_bad_debt: this.txFromJSON<boolean>,
        set_treasury: this.txFromJSON<null>,
        propose_admin: this.txFromJSON<null>,
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
        get_d_token_supply: this.txFromJSON<i128>,
        set_backstop_token: this.txFromJSON<null>,
        set_reserve_factor: this.txFromJSON<null>,
        set_token_contract: this.txFromJSON<null>,
        get_b_token_balance: this.txFromJSON<i128>,
        get_d_token_balance: this.txFromJSON<i128>,
        get_treasury_credit: this.txFromJSON<i128>,
        initiate_liquidation: this.txFromJSON<Result<u32>>,
        collect_treasury_fees: this.txFromJSON<Result<i128>>,
        fill_bad_debt_auction: this.txFromJSON<Result<i128>>,
        fill_interest_auction: this.txFromJSON<Result<readonly [i128, i128]>>,
        get_collateral_factor: this.txFromJSON<u32>,
        set_backstop_contract: this.txFromJSON<null>,
        set_collateral_factor: this.txFromJSON<null>,
        calculate_borrow_limit: this.txFromJSON<Result<i128>>,
        set_backstop_take_rate: this.txFromJSON<null>,
        calculate_health_factor: this.txFromJSON<Result<u32>>,
        create_bad_debt_auction: this.txFromJSON<Result<u32>>,
        create_interest_auction: this.txFromJSON<Result<u32>>,
        get_accumulated_interest: this.txFromJSON<i128>,
        queue_set_reserve_params: this.txFromJSON<null>,
        set_liquidation_fee_rate: this.txFromJSON<null>,
        set_origination_fee_rate: this.txFromJSON<null>,
        apply_queued_reserve_params: this.txFromJSON<null>,
        can_create_interest_auction: this.txFromJSON<boolean>,
        cancel_queued_reserve_params: this.txFromJSON<null>,
        update_pool_state_from_backstop: this.txFromJSON<null>
  }
}