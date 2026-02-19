// @ts-nocheck
// This file is a STUB - not yet generated from the deployed contract.
// TODO: Replace this stub by running the stellar contract bindings ts command documented in README.md
//
// Once the rwa-perps contract is deployed to testnet, regenerate with:
//   stellar contract bindings ts \
//     --rpc-url https://soroban-testnet.stellar.org \
//     --network-passphrase "Test SDF Network ; September 2015" \
//     --contract-id <RWA_PERPS_TESTNET_CONTRACT_ID> \
//     --output-dir packages/contracts/rwa-perps
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
  Typepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}

// TODO: Update contractId once rwa-perps is deployed to testnet.
export const networks = {
  testnet: {
    networkPassphrase: "Test SDF Network ; September 2015",
    contractId: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
  },
} as const;

export const Errors = {
  // Position errors
  1: { message: "PositionNotFound" },
  2: { message: "PositionAlreadyExists" },
  3: { message: "PositionNotLiquidatable" },
  // Liquidation errors
  10: { message: "MarginRatioHealthy" },
  11: { message: "InsufficientMargin" },
  12: { message: "LiquidationPriceTooLow" },
  13: { message: "LiquidationPriceTooHigh" },
  // Market errors
  20: { message: "MarketNotFound" },
  21: { message: "MarketInactive" },
  // Oracle errors
  30: { message: "OraclePriceNotFound" },
  31: { message: "OraclePriceStale" },
  // Arithmetic errors
  40: { message: "ArithmeticError" },
  41: { message: "Overflow" },
  42: { message: "DivisionByZero" },
  // Authorization errors
  50: { message: "Unauthorized" },
  // General errors
  60: { message: "InvalidInput" },
  61: { message: "NotInitialized" },
  62: { message: "AlreadyInitialized" },
  63: { message: "ProtocolPaused" },
  // Funding errors
  70: { message: "InvalidFundingRate" },
  71: { message: "FundingCalculationError" },
  // Margin management errors
  72: { message: "MarginRatioBelowMaintenance" },
  73: { message: "MarginTokenNotSet" },
  // Position validation errors
  80: { message: "ExceedsMaxLeverage" },
  81: { message: "InsufficientInitialMargin" },
};

/**
 * A trader's open position on a perpetual market.
 * size > 0 = long, size < 0 = short.
 */
export interface Position {
  trader: string;
  rwa_token: string;
  size: i128;
  entry_price: i128;
  margin: i128;
  leverage: u32;
  opened_at: u64;
  last_funding_payment: u64;
}

/**
 * Configuration for a single RWA perpetual market.
 */
export interface MarketConfig {
  rwa_token: string;
  max_leverage: u32;
  maintenance_margin: u32;
  initial_margin: u32;
  funding_rate: i128;
  last_funding_update: u64;
  is_active: boolean;
}

/**
 * A recorded funding payment for a position.
 */
export interface FundingPayment {
  position_id: string;
  amount: i128;
  timestamp: u64;
}

export type PositionStatus =
  | { tag: "Open"; values: void }
  | { tag: "Closed"; values: void }
  | { tag: "Liquidated"; values: void };

/**
 * Top-level perpetuals contract storage.
 */
export interface PerpsStorage {
  admin: string;
  oracle: string;
  protocol_paused: boolean;
  protocol_fee_rate: u32;
  liquidation_fee_rate: u32;
}

export interface Client {
  /** Initialize the perpetuals contract */
  initialize: (
    {
      admin,
      oracle,
      protocol_fee_rate,
      liquidation_fee_rate,
    }: {
      admin: string;
      oracle: string;
      protocol_fee_rate: u32;
      liquidation_fee_rate: u32;
    },
    options?: {
      fee?: number;
      timeoutInSeconds?: number;
      simulate?: boolean;
    }
  ) => Promise<AssembledTransaction<null>>;

  /** Get admin address */
  get_admin: (options?: {
    fee?: number;
    timeoutInSeconds?: number;
    simulate?: boolean;
  }) => Promise<AssembledTransaction<string>>;

  /** Get oracle address */
  get_oracle: (options?: {
    fee?: number;
    timeoutInSeconds?: number;
    simulate?: boolean;
  }) => Promise<AssembledTransaction<string>>;

  /** Set oracle address (admin only) */
  set_oracle: (
    { oracle }: { oracle: string },
    options?: {
      fee?: number;
      timeoutInSeconds?: number;
      simulate?: boolean;
    }
  ) => Promise<AssembledTransaction<null>>;

  /** Set protocol paused state (admin only) */
  set_protocol_paused: (
    { paused }: { paused: boolean },
    options?: {
      fee?: number;
      timeoutInSeconds?: number;
      simulate?: boolean;
    }
  ) => Promise<AssembledTransaction<null>>;

  /** Check if protocol is paused */
  is_protocol_paused: (options?: {
    fee?: number;
    timeoutInSeconds?: number;
    simulate?: boolean;
  }) => Promise<AssembledTransaction<boolean>>;

  /** Set protocol fee rate (admin only) */
  set_protocol_fee_rate: (
    { fee_rate }: { fee_rate: u32 },
    options?: {
      fee?: number;
      timeoutInSeconds?: number;
      simulate?: boolean;
    }
  ) => Promise<AssembledTransaction<null>>;

  /** Set liquidation fee rate (admin only) */
  set_liquidation_fee_rate: (
    { fee_rate }: { fee_rate: u32 },
    options?: {
      fee?: number;
      timeoutInSeconds?: number;
      simulate?: boolean;
    }
  ) => Promise<AssembledTransaction<null>>;

  /** Set market configuration (admin only) */
  set_market_config: (
    { rwa_token, config }: { rwa_token: string; config: MarketConfig },
    options?: {
      fee?: number;
      timeoutInSeconds?: number;
      simulate?: boolean;
    }
  ) => Promise<AssembledTransaction<null>>;

  /** Upgrade contract WASM (admin only) */
  upgrade: (
    { new_wasm_hash }: { new_wasm_hash: Buffer },
    options?: {
      fee?: number;
      timeoutInSeconds?: number;
      simulate?: boolean;
    }
  ) => Promise<AssembledTransaction<null>>;

  /** Set margin token address (admin only) */
  set_margin_token: (
    { token }: { token: string },
    options?: {
      fee?: number;
      timeoutInSeconds?: number;
      simulate?: boolean;
    }
  ) => Promise<AssembledTransaction<null>>;

  /** Check if a position is liquidatable */
  check_liquidation: (
    { trader, rwa_token }: { trader: string; rwa_token: string },
    options?: {
      fee?: number;
      timeoutInSeconds?: number;
      simulate?: boolean;
    }
  ) => Promise<AssembledTransaction<Result<boolean>>>;

  /** Liquidate an undercollateralized position */
  liquidate_position: (
    {
      liquidator,
      trader,
      rwa_token,
    }: { liquidator: string; trader: string; rwa_token: string },
    options?: {
      fee?: number;
      timeoutInSeconds?: number;
      simulate?: boolean;
    }
  ) => Promise<AssembledTransaction<Result<i128>>>;

  /** Get liquidation price for a position */
  get_liquidation_price: (
    { trader, rwa_token }: { trader: string; rwa_token: string },
    options?: {
      fee?: number;
      timeoutInSeconds?: number;
      simulate?: boolean;
    }
  ) => Promise<AssembledTransaction<Result<i128>>>;

  /** Update funding rate for a market (admin only) */
  update_funding_rate: (
    { rwa_token, new_rate }: { rwa_token: string; new_rate: i128 },
    options?: {
      fee?: number;
      timeoutInSeconds?: number;
      simulate?: boolean;
    }
  ) => Promise<AssembledTransaction<Result<void>>>;

  /** Accrue funding for a position */
  accrue_funding: (
    { trader, rwa_token }: { trader: string; rwa_token: string },
    options?: {
      fee?: number;
      timeoutInSeconds?: number;
      simulate?: boolean;
    }
  ) => Promise<AssembledTransaction<Result<i128>>>;

  /** Get current funding rate for a market */
  get_funding_rate: (
    { rwa_token }: { rwa_token: string },
    options?: {
      fee?: number;
      timeoutInSeconds?: number;
      simulate?: boolean;
    }
  ) => Promise<AssembledTransaction<Result<i128>>>;

  /** Add collateral to an existing position */
  add_margin: (
    {
      trader,
      rwa_token,
      amount,
    }: { trader: string; rwa_token: string; amount: i128 },
    options?: {
      fee?: number;
      timeoutInSeconds?: number;
      simulate?: boolean;
    }
  ) => Promise<AssembledTransaction<Result<void>>>;

  /** Remove collateral from an existing position */
  remove_margin: (
    {
      trader,
      rwa_token,
      amount,
    }: { trader: string; rwa_token: string; amount: i128 },
    options?: {
      fee?: number;
      timeoutInSeconds?: number;
      simulate?: boolean;
    }
  ) => Promise<AssembledTransaction<Result<void>>>;

  /** Calculate current margin ratio for a position (in basis points) */
  calculate_margin_ratio: (
    { trader, rwa_token }: { trader: string; rwa_token: string },
    options?: {
      fee?: number;
      timeoutInSeconds?: number;
      simulate?: boolean;
    }
  ) => Promise<AssembledTransaction<Result<i128>>>;

  /** Get available margin that can be safely removed from a position */
  get_available_margin: (
    { trader, rwa_token }: { trader: string; rwa_token: string },
    options?: {
      fee?: number;
      timeoutInSeconds?: number;
      simulate?: boolean;
    }
  ) => Promise<AssembledTransaction<Result<i128>>>;

  /** Open a new position (long or short) */
  open_position: (
    {
      trader,
      rwa_token,
      size,
      leverage,
      margin,
    }: {
      trader: string;
      rwa_token: string;
      size: i128;
      leverage: u32;
      margin: i128;
    },
    options?: {
      fee?: number;
      timeoutInSeconds?: number;
      simulate?: boolean;
    }
  ) => Promise<AssembledTransaction<Result<void>>>;

  /** Close a position (full or partial) */
  close_position: (
    {
      trader,
      rwa_token,
      size_to_close,
    }: { trader: string; rwa_token: string; size_to_close: i128 },
    options?: {
      fee?: number;
      timeoutInSeconds?: number;
      simulate?: boolean;
    }
  ) => Promise<AssembledTransaction<Result<void>>>;

  /** Get a specific position for a trader */
  get_position: (
    { trader, rwa_token }: { trader: string; rwa_token: string },
    options?: {
      fee?: number;
      timeoutInSeconds?: number;
      simulate?: boolean;
    }
  ) => Promise<AssembledTransaction<Result<Position>>>;

  /** Get all positions for a trader */
  get_user_positions: (
    { trader }: { trader: string },
    options?: {
      fee?: number;
      timeoutInSeconds?: number;
      simulate?: boolean;
    }
  ) => Promise<AssembledTransaction<Array<Position>>>;
}

export class Client extends ContractClient {
  static async deploy<T = Client>(
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        wasmHash: Buffer | string;
        salt?: Buffer | Uint8Array;
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy(null, options);
  }
  constructor(public readonly options: ContractClientOptions) {
    // TODO: Replace the empty ContractSpec with the XDR spec strings generated by:
    //   stellar contract bindings ts (see README.md)
    super(new ContractSpec([]), options);
  }
  public readonly fromJSON = {
    initialize: this.txFromJSON<null>,
    get_admin: this.txFromJSON<string>,
    get_oracle: this.txFromJSON<string>,
    set_oracle: this.txFromJSON<null>,
    set_protocol_paused: this.txFromJSON<null>,
    is_protocol_paused: this.txFromJSON<boolean>,
    set_protocol_fee_rate: this.txFromJSON<null>,
    set_liquidation_fee_rate: this.txFromJSON<null>,
    set_market_config: this.txFromJSON<null>,
    upgrade: this.txFromJSON<null>,
    set_margin_token: this.txFromJSON<null>,
    check_liquidation: this.txFromJSON<Result<boolean>>,
    liquidate_position: this.txFromJSON<Result<i128>>,
    get_liquidation_price: this.txFromJSON<Result<i128>>,
    update_funding_rate: this.txFromJSON<Result<void>>,
    accrue_funding: this.txFromJSON<Result<i128>>,
    get_funding_rate: this.txFromJSON<Result<i128>>,
    add_margin: this.txFromJSON<Result<void>>,
    remove_margin: this.txFromJSON<Result<void>>,
    calculate_margin_ratio: this.txFromJSON<Result<i128>>,
    get_available_margin: this.txFromJSON<Result<i128>>,
    open_position: this.txFromJSON<Result<void>>,
    close_position: this.txFromJSON<Result<void>>,
    get_position: this.txFromJSON<Result<Position>>,
    get_user_positions: this.txFromJSON<Array<Position>>,
  };
}
