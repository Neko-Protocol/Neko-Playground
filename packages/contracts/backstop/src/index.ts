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
    contractId: "CDTFRINWJOMLGYS64N7JICGNBCFKKSPJBNMI7FHTDOHZQ2RAKTJEXCRO",
    pool1ContractId: "CDTFRINWJOMLGYS64N7JICGNBCFKKSPJBNMI7FHTDOHZQ2RAKTJEXCRO",
    pool2ContractId: "CARYWBLZCXSSZSSGL2VRVDS57P7KIV7NOBESGBR3SKQXDIFDDZRRFHQ6",
  },
} as const

export const Errors = {
  1: {message:"NotAuthorized"},
  2: {message:"NotInitialized"},
  3: {message:"AlreadyInitialized"},
  4: {message:"NotPositive"},
  5: {message:"ArithmeticError"},
  10: {message:"TokenContractNotSet"},
  20: {message:"InsufficientBackstopDeposit"},
  21: {message:"WithdrawalQueueFull"},
  22: {message:"WithdrawalQueueNotExpired"},
  23: {message:"BadDebtNotCovered"},
  24: {message:"BackstopThresholdNotMet"}
}


/**
 * A single withdrawal queue entry.
 * `exp` is the earliest timestamp at which the depositor may execute the withdrawal.
 */
export interface Q4W {
  /**
 * Token amount queued for withdrawal.
 */
amount: i128;
  /**
 * Expiration timestamp: creation_time + Q4W_LOCK_SECONDS.
 */
exp: u64;
}

export type DataKey = {tag: "Admin", values: void} | {tag: "PoolContract", values: void} | {tag: "BackstopToken", values: void} | {tag: "BackstopThreshold", values: void} | {tag: "ProposedAdmin", values: void} | {tag: "UserBalance", values: readonly [string]} | {tag: "BackstopTotal", values: void} | {tag: "BackstopQueuedTotal", values: void};

/**
 * Mirror of the pool's PoolState — variant order must stay identical so the
 * u32 ordinal pushed via pool.update_pool_state_from_backstop stays consistent.
 */
export type PoolState = {tag: "Active", values: void} | {tag: "OnIce", values: void} | {tag: "Frozen", values: void};


/**
 * Per-depositor balance record.
 * 
 * `q4w` holds up to MAX_Q4W_SIZE simultaneous withdrawal queue entries.
 * Entries are ordered oldest-first; dequeue_withdrawal() removes the newest
 * (tail), withdraw() consumes from the oldest (head) once expired.
 */
export interface UserBalance {
  /**
 * Tokens actively deposited (not queued).
 */
amount: i128;
  /**
 * Pending withdrawal queue entries (oldest → newest).
 */
q4w: Array<Q4W>;
}








export interface Client {
  /**
   * Construct and simulate a deposit transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Deposit backstop tokens.
   */
  deposit: ({depositor, amount}: {depositor: string, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a withdraw transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Withdraw from the oldest expired Q4W entry.
   */
  withdraw: ({depositor, amount}: {depositor: string, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_admin: (options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a get_total transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_total: (options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a initialize transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  initialize: ({admin, pool, backstop_token, backstop_threshold}: {admin: string, pool: string, backstop_token: string, backstop_threshold: i128}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a accept_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Step 2: pending admin accepts (must match `propose_admin`).
   */
  accept_admin: (options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a propose_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Step 1 of two-step admin transfer. Current admin only.
   */
  propose_admin: ({proposed}: {proposed: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a set_threshold transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_threshold: ({threshold}: {threshold: i128}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a cover_bad_debt transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Cover bad debt by reducing backstop balance.
   * Only callable by the registered pool contract.
   */
  cover_bad_debt: ({caller, amount}: {caller: string, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_pool_state transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_pool_state: (options?: MethodOptions) => Promise<AssembledTransaction<PoolState>>

  /**
   * Construct and simulate a get_user_balance transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_user_balance: ({depositor}: {depositor: string}, options?: MethodOptions) => Promise<AssembledTransaction<UserBalance>>

  /**
   * Construct and simulate a queue_withdrawal transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Add `amount` to the withdrawal queue (up to MAX_Q4W_SIZE entries per user).
   */
  queue_withdrawal: ({depositor, amount}: {depositor: string, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_pool_contract transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_pool_contract: (options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a dequeue_withdrawal transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Cancel the most recently queued withdrawal entry.
   */
  dequeue_withdrawal: ({depositor}: {depositor: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_backstop_token transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_backstop_token: (options?: MethodOptions) => Promise<AssembledTransaction<Option<string>>>

  /**
   * Construct and simulate a set_backstop_token transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_backstop_token: ({token}: {token: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

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
    return ContractClient.deploy(null, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAACwAAAAAAAAANTm90QXV0aG9yaXplZAAAAAAAAAEAAAAAAAAADk5vdEluaXRpYWxpemVkAAAAAAACAAAAAAAAABJBbHJlYWR5SW5pdGlhbGl6ZWQAAAAAAAMAAAAAAAAAC05vdFBvc2l0aXZlAAAAAAQAAAAAAAAAD0FyaXRobWV0aWNFcnJvcgAAAAAFAAAAAAAAABNUb2tlbkNvbnRyYWN0Tm90U2V0AAAAAAoAAAAAAAAAG0luc3VmZmljaWVudEJhY2tzdG9wRGVwb3NpdAAAAAAUAAAAAAAAABNXaXRoZHJhd2FsUXVldWVGdWxsAAAAABUAAAAAAAAAGVdpdGhkcmF3YWxRdWV1ZU5vdEV4cGlyZWQAAAAAAAAWAAAAAAAAABFCYWREZWJ0Tm90Q292ZXJlZAAAAAAAABcAAAAAAAAAF0JhY2tzdG9wVGhyZXNob2xkTm90TWV0AAAAABg=",
        "AAAAAQAAAHNBIHNpbmdsZSB3aXRoZHJhd2FsIHF1ZXVlIGVudHJ5LgpgZXhwYCBpcyB0aGUgZWFybGllc3QgdGltZXN0YW1wIGF0IHdoaWNoIHRoZSBkZXBvc2l0b3IgbWF5IGV4ZWN1dGUgdGhlIHdpdGhkcmF3YWwuAAAAAAAAAAADUTRXAAAAAAIAAAAjVG9rZW4gYW1vdW50IHF1ZXVlZCBmb3Igd2l0aGRyYXdhbC4AAAAABmFtb3VudAAAAAAACwAAADdFeHBpcmF0aW9uIHRpbWVzdGFtcDogY3JlYXRpb25fdGltZSArIFE0V19MT0NLX1NFQ09ORFMuAAAAAANleHAAAAAABg==",
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAACAAAAAAAAAAAAAAABUFkbWluAAAAAAAAAAAAAAAAAAAMUG9vbENvbnRyYWN0AAAAAAAAAAAAAAANQmFja3N0b3BUb2tlbgAAAAAAAAAAAAAAAAAAEUJhY2tzdG9wVGhyZXNob2xkAAAAAAAAAAAAAAAAAAANUHJvcG9zZWRBZG1pbgAAAAAAAAEAAAAAAAAAC1VzZXJCYWxhbmNlAAAAAAEAAAATAAAAAAAAAAAAAAANQmFja3N0b3BUb3RhbAAAAAAAAAAAAAAAAAAAE0JhY2tzdG9wUXVldWVkVG90YWwA",
        "AAAAAgAAAJlNaXJyb3Igb2YgdGhlIHBvb2wncyBQb29sU3RhdGUg4oCUIHZhcmlhbnQgb3JkZXIgbXVzdCBzdGF5IGlkZW50aWNhbCBzbyB0aGUKdTMyIG9yZGluYWwgcHVzaGVkIHZpYSBwb29sLnVwZGF0ZV9wb29sX3N0YXRlX2Zyb21fYmFja3N0b3Agc3RheXMgY29uc2lzdGVudC4AAAAAAAAAAAAACVBvb2xTdGF0ZQAAAAAAAAMAAAAAAAAAAAAAAAZBY3RpdmUAAAAAAAAAAAAAAAAABU9uSWNlAAAAAAAAAAAAAAAAAAAGRnJvemVuAAA=",
        "AAAAAQAAAO9QZXItZGVwb3NpdG9yIGJhbGFuY2UgcmVjb3JkLgoKYHE0d2AgaG9sZHMgdXAgdG8gTUFYX1E0V19TSVpFIHNpbXVsdGFuZW91cyB3aXRoZHJhd2FsIHF1ZXVlIGVudHJpZXMuCkVudHJpZXMgYXJlIG9yZGVyZWQgb2xkZXN0LWZpcnN0OyBkZXF1ZXVlX3dpdGhkcmF3YWwoKSByZW1vdmVzIHRoZSBuZXdlc3QKKHRhaWwpLCB3aXRoZHJhdygpIGNvbnN1bWVzIGZyb20gdGhlIG9sZGVzdCAoaGVhZCkgb25jZSBleHBpcmVkLgAAAAAAAAAAC1VzZXJCYWxhbmNlAAAAAAIAAAAnVG9rZW5zIGFjdGl2ZWx5IGRlcG9zaXRlZCAobm90IHF1ZXVlZCkuAAAAAAZhbW91bnQAAAAAAAsAAAA1UGVuZGluZyB3aXRoZHJhd2FsIHF1ZXVlIGVudHJpZXMgKG9sZGVzdCDihpIgbmV3ZXN0KS4AAAAAAAADcTR3AAAAA+oAAAfQAAAAA1E0VwA=",
        "AAAABQAAAAAAAAAAAAAAEkJhY2tzdG9wUXVldWVFdmVudAAAAAAAAQAAABRiYWNrc3RvcF9xdWV1ZV9ldmVudAAAAAMAAAAAAAAACWRlcG9zaXRvcgAAAAAAABMAAAAAAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAAAAAAREV4cGlyYXRpb24gdGltZXN0YW1wIGZvciBxdWV1ZV93aXRoZHJhd2FsOyAwIGZvciBkZXF1ZXVlX3dpdGhkcmF3YWwuAAAAA2V4cAAAAAAGAAAAAAAAAAI=",
        "AAAABQAAAAAAAAAAAAAAE0JhZERlYnRDb3ZlcmVkRXZlbnQAAAAAAQAAABZiYWRfZGVidF9jb3ZlcmVkX2V2ZW50AAAAAAACAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAAAAAAAAAAAAluZXdfdG90YWwAAAAAAAALAAAAAAAAAAI=",
        "AAAABQAAAAAAAAAAAAAAFEJhY2tzdG9wRGVwb3NpdEV2ZW50AAAAAQAAABZiYWNrc3RvcF9kZXBvc2l0X2V2ZW50AAAAAAADAAAAAAAAAAlkZXBvc2l0b3IAAAAAAAATAAAAAAAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAAAAAAAFdG90YWwAAAAAAAALAAAAAAAAAAI=",
        "AAAABQAAAAAAAAAAAAAAFUJhY2tzdG9wV2l0aGRyYXdFdmVudAAAAAAAAAEAAAAXYmFja3N0b3Bfd2l0aGRyYXdfZXZlbnQAAAAAAwAAAAAAAAAJZGVwb3NpdG9yAAAAAAAAEwAAAAAAAAAAAAAABmFtb3VudAAAAAAACwAAAAAAAAAAAAAABXRvdGFsAAAAAAAACwAAAAAAAAAC",
        "AAAABQAAAAAAAAAAAAAAFVBvb2xTdGF0ZVVwZGF0ZWRFdmVudAAAAAAAAAEAAAAYcG9vbF9zdGF0ZV91cGRhdGVkX2V2ZW50AAAAAQAAAAAAAAAJbmV3X3N0YXRlAAAAAAAH0AAAAAlQb29sU3RhdGUAAAAAAAAAAAAAAg==",
        "AAAABQAAAAAAAAAAAAAAGUJhY2tzdG9wQWRtaW5DaGFuZ2VkRXZlbnQAAAAAAAABAAAAHGJhY2tzdG9wX2FkbWluX2NoYW5nZWRfZXZlbnQAAAABAAAAAAAAAAluZXdfYWRtaW4AAAAAAAATAAAAAAAAAAI=",
        "AAAABQAAAAAAAAAAAAAAGkJhY2tzdG9wQWRtaW5Qcm9wb3NlZEV2ZW50AAAAAAABAAAAHWJhY2tzdG9wX2FkbWluX3Byb3Bvc2VkX2V2ZW50AAAAAAAAAQAAAAAAAAAIcHJvcG9zZWQAAAATAAAAAAAAAAI=",
        "AAAAAAAAABhEZXBvc2l0IGJhY2tzdG9wIHRva2Vucy4AAAAHZGVwb3NpdAAAAAACAAAAAAAAAAlkZXBvc2l0b3IAAAAAAAATAAAAAAAAAAZhbW91bnQAAAAAAAsAAAABAAAD6QAAAAIAAAAD",
        "AAAAAAAAACtXaXRoZHJhdyBmcm9tIHRoZSBvbGRlc3QgZXhwaXJlZCBRNFcgZW50cnkuAAAAAAh3aXRoZHJhdwAAAAIAAAAAAAAACWRlcG9zaXRvcgAAAAAAABMAAAAAAAAABmFtb3VudAAAAAAACwAAAAEAAAPpAAAAAgAAAAM=",
        "AAAAAAAAAAAAAAAJZ2V0X2FkbWluAAAAAAAAAAAAAAEAAAAT",
        "AAAAAAAAAAAAAAAJZ2V0X3RvdGFsAAAAAAAAAAAAAAEAAAAL",
        "AAAAAAAAAAAAAAAKaW5pdGlhbGl6ZQAAAAAABAAAAAAAAAAFYWRtaW4AAAAAAAATAAAAAAAAAARwb29sAAAAEwAAAAAAAAAOYmFja3N0b3BfdG9rZW4AAAAAABMAAAAAAAAAEmJhY2tzdG9wX3RocmVzaG9sZAAAAAAACwAAAAA=",
        "AAAAAAAAADtTdGVwIDI6IHBlbmRpbmcgYWRtaW4gYWNjZXB0cyAobXVzdCBtYXRjaCBgcHJvcG9zZV9hZG1pbmApLgAAAAAMYWNjZXB0X2FkbWluAAAAAAAAAAA=",
        "AAAAAAAAADZTdGVwIDEgb2YgdHdvLXN0ZXAgYWRtaW4gdHJhbnNmZXIuIEN1cnJlbnQgYWRtaW4gb25seS4AAAAAAA1wcm9wb3NlX2FkbWluAAAAAAAAAQAAAAAAAAAIcHJvcG9zZWQAAAATAAAAAA==",
        "AAAAAAAAAAAAAAANc2V0X3RocmVzaG9sZAAAAAAAAAEAAAAAAAAACXRocmVzaG9sZAAAAAAAAAsAAAAA",
        "AAAAAAAAAFtDb3ZlciBiYWQgZGVidCBieSByZWR1Y2luZyBiYWNrc3RvcCBiYWxhbmNlLgpPbmx5IGNhbGxhYmxlIGJ5IHRoZSByZWdpc3RlcmVkIHBvb2wgY29udHJhY3QuAAAAAA5jb3Zlcl9iYWRfZGVidAAAAAAAAgAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAAZhbW91bnQAAAAAAAsAAAABAAAD6QAAAAIAAAAD",
        "AAAAAAAAAAAAAAAOZ2V0X3Bvb2xfc3RhdGUAAAAAAAAAAAABAAAH0AAAAAlQb29sU3RhdGUAAAA=",
        "AAAAAAAAAAAAAAAQZ2V0X3VzZXJfYmFsYW5jZQAAAAEAAAAAAAAACWRlcG9zaXRvcgAAAAAAABMAAAABAAAH0AAAAAtVc2VyQmFsYW5jZQA=",
        "AAAAAAAAAEtBZGQgYGFtb3VudGAgdG8gdGhlIHdpdGhkcmF3YWwgcXVldWUgKHVwIHRvIE1BWF9RNFdfU0laRSBlbnRyaWVzIHBlciB1c2VyKS4AAAAAEHF1ZXVlX3dpdGhkcmF3YWwAAAACAAAAAAAAAAlkZXBvc2l0b3IAAAAAAAATAAAAAAAAAAZhbW91bnQAAAAAAAsAAAABAAAD6QAAAAIAAAAD",
        "AAAAAAAAAAAAAAARZ2V0X3Bvb2xfY29udHJhY3QAAAAAAAAAAAAAAQAAABM=",
        "AAAAAAAAADFDYW5jZWwgdGhlIG1vc3QgcmVjZW50bHkgcXVldWVkIHdpdGhkcmF3YWwgZW50cnkuAAAAAAAAEmRlcXVldWVfd2l0aGRyYXdhbAAAAAAAAQAAAAAAAAAJZGVwb3NpdG9yAAAAAAAAEwAAAAEAAAPpAAAAAgAAAAM=",
        "AAAAAAAAAAAAAAASZ2V0X2JhY2tzdG9wX3Rva2VuAAAAAAAAAAAAAQAAA+gAAAAT",
        "AAAAAAAAAAAAAAASc2V0X2JhY2tzdG9wX3Rva2VuAAAAAAABAAAAAAAAAAV0b2tlbgAAAAAAABMAAAAA" ]),
      options
    )
  }
  public readonly fromJSON = {
    deposit: this.txFromJSON<Result<void>>,
        withdraw: this.txFromJSON<Result<void>>,
        get_admin: this.txFromJSON<string>,
        get_total: this.txFromJSON<i128>,
        initialize: this.txFromJSON<null>,
        accept_admin: this.txFromJSON<null>,
        propose_admin: this.txFromJSON<null>,
        set_threshold: this.txFromJSON<null>,
        cover_bad_debt: this.txFromJSON<Result<void>>,
        get_pool_state: this.txFromJSON<PoolState>,
        get_user_balance: this.txFromJSON<UserBalance>,
        queue_withdrawal: this.txFromJSON<Result<void>>,
        get_pool_contract: this.txFromJSON<string>,
        dequeue_withdrawal: this.txFromJSON<Result<void>>,
        get_backstop_token: this.txFromJSON<Option<string>>,
        set_backstop_token: this.txFromJSON<null>
  }
}