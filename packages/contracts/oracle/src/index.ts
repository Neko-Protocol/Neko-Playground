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
    contractId: "CAYQIQ24IMRFYFXLTTCMSPA6HBQKUH2GLKRWU3B23VJF33X43WFOCC55",
  },
} as const;

/**
 * Quoted asset definition (SEP-40 compatible)
 */
export type Asset =
  | { tag: "Stellar"; values: readonly [string] }
  | { tag: "Other"; values: readonly [string] };

/**
 * Price record definition (SEP-40 compatible)
 */
export interface PriceData {
  price: i128;
  timestamp: u64;
}

/**
 * Complete on-chain RWA metadata
 */
export interface RWAMetadata {
  /**
   * Asset identifier (code/symbol in the oracle)
   */
  asset_id: string;
  /**
   * RWA asset type classification
   */
  asset_type: RWAAssetType;
  /**
   * Creation timestamp
   */
  created_at: u64;
  /**
   * Description of the asset
   */
  description: string;
  /**
   * External identifiers as key-value pairs (ISIN, LEI, CUSIP, etc.)
   */
  external_ids: Array<readonly [string, string]>;
  /**
   * Issuer address
   */
  issuer: string;
  /**
   * Jurisdiction code (ISO 3166-1 alpha-2)
   */
  jurisdiction: string;
  /**
   * URI pointing to legal documentation
   */
  legal_docs_uri: Option<string>;
  /**
   * Extensible key-value metadata
   */
  metadata: Array<readonly [string, string]>;
  /**
   * Human-readable name
   */
  name: string;
  /**
   * Tokenization information
   */
  tokenization_info: TokenizationInfo;
  /**
   * Underlying asset identifier or description
   */
  underlying_asset: string;
  /**
   * Last update timestamp
   */
  updated_at: u64;
  /**
   * Valuation methodology
   */
  valuation_method: ValuationMethod;
}

/**
 * RWA asset type classification
 */
export type RWAAssetType =
  | { tag: "RealEstate"; values: void }
  | { tag: "Equity"; values: void }
  | { tag: "Bond"; values: void }
  | { tag: "Commodity"; values: void }
  | { tag: "Invoice"; values: void }
  | { tag: "Fund"; values: void }
  | { tag: "PrivateDebt"; values: void }
  | { tag: "Infrastructure"; values: void }
  | { tag: "Other"; values: void };

/**
 * Valuation methodology for the underlying asset
 */
export type ValuationMethod =
  | { tag: "Appraisal"; values: void }
  | { tag: "Market"; values: void }
  | { tag: "Index"; values: void }
  | { tag: "Oracle"; values: void }
  | { tag: "Nav"; values: void }
  | { tag: "Other"; values: void };

/**
 * Tokenization details for an RWA
 */
export interface TokenizationInfo {
  /**
   * Token contract address (if tokenized)
   */
  token_contract: Option<string>;
  /**
   * Tokenization date (unix timestamp)
   */
  tokenization_date: Option<u64>;
  /**
   * Total supply of tokens
   */
  total_supply: Option<i128>;
  /**
   * Identifier of the underlying off-chain asset
   */
  underlying_asset_id: Option<string>;
}

export const Errors = {
  /**
   * Asset not found
   */
  1: { message: "AssetNotFound" },
  /**
   * Asset already exists
   */
  2: { message: "AssetAlreadyExists" },
  /**
   * Invalid RWA type
   */
  3: { message: "InvalidRWAType" },
  /**
   * Invalid metadata
   */
  4: { message: "InvalidMetadata" },
  /**
   * Invalid price (zero or negative)
   */
  5: { message: "InvalidPrice" },
  /**
   * Unauthorized access
   */
  6: { message: "Unauthorized" },
  /**
   * Timestamp is too far in the future
   */
  7: { message: "TimestampInFuture" },
  /**
   * Timestamp is too old or not strictly increasing
   */
  8: { message: "TimestampTooOld" },
};

export type DataKey =
  | { tag: "Prices"; values: readonly [Asset] }
  | { tag: "TokenToAsset"; values: readonly [string] };

export interface RWAOracleStorage {
  asset_types: Map<Asset, RWAAssetType>;
  assets: Array<Asset>;
  base: Asset;
  decimals: u32;
  last_timestamp: u64;
  max_staleness: u64;
  resolution: u32;
  rwa_metadata: Map<string, RWAMetadata>;
}

export interface Client {
  /**
   * Construct and simulate a base transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  base: (options?: MethodOptions) => Promise<AssembledTransaction<Asset>>;

  /**
   * Construct and simulate a price transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  price: (
    { asset, timestamp }: { asset: Asset; timestamp: u64 },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<Option<PriceData>>>;

  /**
   * Construct and simulate a assets transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  assets: (
    options?: MethodOptions
  ) => Promise<AssembledTransaction<Array<Asset>>>;

  /**
   * Construct and simulate a prices transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  prices: (
    { asset, records }: { asset: Asset; records: u32 },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<Option<Array<PriceData>>>>;

  /**
   * Construct and simulate a upgrade transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Upgrade the contract to new wasm
   */
  upgrade: (
    { new_wasm_hash }: { new_wasm_hash: Buffer },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a decimals transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  decimals: (options?: MethodOptions) => Promise<AssembledTransaction<u32>>;

  /**
   * Construct and simulate a lastprice transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  lastprice: (
    { asset }: { asset: Asset },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<Option<PriceData>>>;

  /**
   * Construct and simulate a add_assets transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  add_assets: (
    { assets }: { assets: Array<Asset> },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a resolution transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  resolution: (options?: MethodOptions) => Promise<AssembledTransaction<u32>>;

  /**
   * Construct and simulate a max_staleness transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get the configured maximum staleness in seconds
   */
  max_staleness: (
    options?: MethodOptions
  ) => Promise<AssembledTransaction<u64>>;

  /**
   * Construct and simulate a set_asset_price transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_asset_price: (
    {
      asset_id,
      price,
      timestamp,
    }: { asset_id: Asset; price: i128; timestamp: u64 },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a get_rwa_metadata transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get complete RWA metadata for an asset
   */
  get_rwa_metadata: (
    { asset_id }: { asset_id: string },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<Result<RWAMetadata>>>;

  /**
   * Construct and simulate a set_rwa_metadata transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Register or update RWA metadata for an asset
   */
  set_rwa_metadata: (
    { asset_id, metadata }: { asset_id: string; metadata: RWAMetadata },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<Result<void>>>;

  /**
   * Construct and simulate a set_max_staleness transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Set the maximum acceptable age (in seconds) for price data
   */
  set_max_staleness: (
    { max_seconds }: { max_seconds: u64 },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<null>>;

  /**
   * Construct and simulate a get_all_rwa_assets transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get all registered RWA asset IDs
   */
  get_all_rwa_assets: (
    options?: MethodOptions
  ) => Promise<AssembledTransaction<Array<string>>>;

  /**
   * Construct and simulate a get_rwa_asset_type transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get RWA asset type for an asset
   */
  get_rwa_asset_type: (
    { asset }: { asset: Asset },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<Option<RWAAssetType>>>;

  /**
   * Construct and simulate a get_tokenization_info transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Get tokenization information for an RWA
   */
  get_tokenization_info: (
    { asset_id }: { asset_id: string },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<Result<TokenizationInfo>>>;

  /**
   * Construct and simulate a get_asset_id_from_token transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Resolve a token contract address to its oracle asset identifier
   */
  get_asset_id_from_token: (
    { token_address }: { token_address: string },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<Result<string>>>;

  /**
   * Construct and simulate a update_tokenization_info transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Update tokenization information for a previously registered asset
   */
  update_tokenization_info: (
    {
      asset_id,
      tokenization_info,
    }: { asset_id: string; tokenization_info: TokenizationInfo },
    options?: MethodOptions
  ) => Promise<AssembledTransaction<Result<void>>>;
}
export class Client extends ContractClient {
  static async deploy<T = Client>(
    /** Constructor/Initialization Args for the contract's `__constructor` method */
    {
      admin,
      assets,
      base,
      decimals,
      resolution,
    }: {
      admin: string;
      assets: Array<Asset>;
      base: Asset;
      decimals: u32;
      resolution: u32;
    },
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
    return ContractClient.deploy(
      { admin, assets, base, decimals, resolution },
      options
    );
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([
        "AAAAAgAAACtRdW90ZWQgYXNzZXQgZGVmaW5pdGlvbiAoU0VQLTQwIGNvbXBhdGlibGUpAAAAAAAAAAAFQXNzZXQAAAAAAAACAAAAAQAAAClDYW4gYmUgYSBTdGVsbGFyIENsYXNzaWMgb3IgU29yb2JhbiBhc3NldAAAAAAAAAdTdGVsbGFyAAAAAAEAAAATAAAAAQAAACZGb3IgYW55IGV4dGVybmFsIHRva2Vucy9hc3NldHMvc3ltYm9scwAAAAAABU90aGVyAAAAAAAAAQAAABE=",
        "AAAAAQAAACtQcmljZSByZWNvcmQgZGVmaW5pdGlvbiAoU0VQLTQwIGNvbXBhdGlibGUpAAAAAAAAAAAJUHJpY2VEYXRhAAAAAAAAAgAAAAAAAAAFcHJpY2UAAAAAAAALAAAAAAAAAAl0aW1lc3RhbXAAAAAAAAAG",
        "AAAAAQAAAB5Db21wbGV0ZSBvbi1jaGFpbiBSV0EgbWV0YWRhdGEAAAAAAAAAAAALUldBTWV0YWRhdGEAAAAADgAAACxBc3NldCBpZGVudGlmaWVyIChjb2RlL3N5bWJvbCBpbiB0aGUgb3JhY2xlKQAAAAhhc3NldF9pZAAAABEAAAAdUldBIGFzc2V0IHR5cGUgY2xhc3NpZmljYXRpb24AAAAAAAAKYXNzZXRfdHlwZQAAAAAH0AAAAAxSV0FBc3NldFR5cGUAAAASQ3JlYXRpb24gdGltZXN0YW1wAAAAAAAKY3JlYXRlZF9hdAAAAAAABgAAABhEZXNjcmlwdGlvbiBvZiB0aGUgYXNzZXQAAAALZGVzY3JpcHRpb24AAAAAEAAAAEBFeHRlcm5hbCBpZGVudGlmaWVycyBhcyBrZXktdmFsdWUgcGFpcnMgKElTSU4sIExFSSwgQ1VTSVAsIGV0Yy4pAAAADGV4dGVybmFsX2lkcwAAA+oAAAPtAAAAAgAAABEAAAAQAAAADklzc3VlciBhZGRyZXNzAAAAAAAGaXNzdWVyAAAAAAATAAAAJkp1cmlzZGljdGlvbiBjb2RlIChJU08gMzE2Ni0xIGFscGhhLTIpAAAAAAAManVyaXNkaWN0aW9uAAAAEQAAACNVUkkgcG9pbnRpbmcgdG8gbGVnYWwgZG9jdW1lbnRhdGlvbgAAAAAObGVnYWxfZG9jc191cmkAAAAAA+gAAAAQAAAAHUV4dGVuc2libGUga2V5LXZhbHVlIG1ldGFkYXRhAAAAAAAACG1ldGFkYXRhAAAD6gAAA+0AAAACAAAAEQAAABAAAAATSHVtYW4tcmVhZGFibGUgbmFtZQAAAAAEbmFtZQAAABAAAAAYVG9rZW5pemF0aW9uIGluZm9ybWF0aW9uAAAAEXRva2VuaXphdGlvbl9pbmZvAAAAAAAH0AAAABBUb2tlbml6YXRpb25JbmZvAAAAKlVuZGVybHlpbmcgYXNzZXQgaWRlbnRpZmllciBvciBkZXNjcmlwdGlvbgAAAAAAEHVuZGVybHlpbmdfYXNzZXQAAAAQAAAAFUxhc3QgdXBkYXRlIHRpbWVzdGFtcAAAAAAAAAp1cGRhdGVkX2F0AAAAAAAGAAAAFVZhbHVhdGlvbiBtZXRob2RvbG9neQAAAAAAABB2YWx1YXRpb25fbWV0aG9kAAAH0AAAAA9WYWx1YXRpb25NZXRob2QA",
        "AAAAAgAAAB1SV0EgYXNzZXQgdHlwZSBjbGFzc2lmaWNhdGlvbgAAAAAAAAAAAAAMUldBQXNzZXRUeXBlAAAACQAAAAAAAAAlQ29tbWVyY2lhbCBvciByZXNpZGVudGlhbCByZWFsIGVzdGF0ZQAAAAAAAApSZWFsRXN0YXRlAAAAAAAAAAAAJVN0b2Nrcywgc2hhcmVzLCBvciBlcXVpdHkgaW5zdHJ1bWVudHMAAAAAAAAGRXF1aXR5AAAAAAAAAAAAHUdvdmVybm1lbnQgb3IgY29ycG9yYXRlIGJvbmRzAAAAAAAABEJvbmQAAAAAAAAAJ1BoeXNpY2FsIGNvbW1vZGl0aWVzIChnb2xkLCBvaWwsIGdyYWluKQAAAAAJQ29tbW9kaXR5AAAAAAAAAAAAACdUcmFkZSByZWNlaXZhYmxlcyBhbmQgaW52b2ljZSBmYWN0b3JpbmcAAAAAB0ludm9pY2UAAAAAAAAAAClFVEZzLCBtdXR1YWwgZnVuZHMsIG9yIHBvb2xlZCBpbnZlc3RtZW50cwAAAAAAAARGdW5kAAAAAAAAACNQcml2YXRlIGNyZWRpdCBhbmQgbG9hbiBpbnN0cnVtZW50cwAAAAALUHJpdmF0ZURlYnQAAAAAAAAAACVJbmZyYXN0cnVjdHVyZSBwcm9qZWN0cyBhbmQgdXRpbGl0aWVzAAAAAAAADkluZnJhc3RydWN0dXJlAAAAAAAAAAAAH0FueSBvdGhlciBSV0Egbm90IGNvdmVyZWQgYWJvdmUAAAAABU90aGVyAAAA",
        "AAAAAgAAAC5WYWx1YXRpb24gbWV0aG9kb2xvZ3kgZm9yIHRoZSB1bmRlcmx5aW5nIGFzc2V0AAAAAAAAAAAAD1ZhbHVhdGlvbk1ldGhvZAAAAAAGAAAAAAAAACJQcm9mZXNzaW9uYWwgdGhpcmQtcGFydHkgYXBwcmFpc2FsAAAAAAAJQXBwcmFpc2FsAAAAAAAAAAAAAC5NYXJrZXQtYmFzZWQgcHJpY2luZyAoY29tcGFyYWJsZSBzYWxlcy90cmFkZXMpAAAAAAAGTWFya2V0AAAAAAAAAAAAFEluZGV4LWxpbmtlZCBwcmljaW5nAAAABUluZGV4AAAAAAAAAAAAABpPbi1jaGFpbiBvcmFjbGUgcHJpY2UgZmVlZAAAAAAABk9yYWNsZQAAAAAAAAAAACNOZXQgQXNzZXQgVmFsdWUgY2FsY3VsYXRpb24gKGZ1bmRzKQAAAAADTmF2AAAAAAAAAAAbT3RoZXIgdmFsdWF0aW9uIG1ldGhvZG9sb2d5AAAAAAVPdGhlcgAAAA==",
        "AAAAAQAAAB9Ub2tlbml6YXRpb24gZGV0YWlscyBmb3IgYW4gUldBAAAAAAAAAAAQVG9rZW5pemF0aW9uSW5mbwAAAAQAAAAlVG9rZW4gY29udHJhY3QgYWRkcmVzcyAoaWYgdG9rZW5pemVkKQAAAAAAAA50b2tlbl9jb250cmFjdAAAAAAD6AAAABMAAAAiVG9rZW5pemF0aW9uIGRhdGUgKHVuaXggdGltZXN0YW1wKQAAAAAAEXRva2VuaXphdGlvbl9kYXRlAAAAAAAD6AAAAAYAAAAWVG90YWwgc3VwcGx5IG9mIHRva2VucwAAAAAADHRvdGFsX3N1cHBseQAAA+gAAAALAAAALElkZW50aWZpZXIgb2YgdGhlIHVuZGVybHlpbmcgb2ZmLWNoYWluIGFzc2V0AAAAE3VuZGVybHlpbmdfYXNzZXRfaWQAAAAD6AAAABA=",
        "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAACAAAAA9Bc3NldCBub3QgZm91bmQAAAAADUFzc2V0Tm90Rm91bmQAAAAAAAABAAAAFEFzc2V0IGFscmVhZHkgZXhpc3RzAAAAEkFzc2V0QWxyZWFkeUV4aXN0cwAAAAAAAgAAABBJbnZhbGlkIFJXQSB0eXBlAAAADkludmFsaWRSV0FUeXBlAAAAAAADAAAAEEludmFsaWQgbWV0YWRhdGEAAAAPSW52YWxpZE1ldGFkYXRhAAAAAAQAAAAgSW52YWxpZCBwcmljZSAoemVybyBvciBuZWdhdGl2ZSkAAAAMSW52YWxpZFByaWNlAAAABQAAABNVbmF1dGhvcml6ZWQgYWNjZXNzAAAAAAxVbmF1dGhvcml6ZWQAAAAGAAAAIlRpbWVzdGFtcCBpcyB0b28gZmFyIGluIHRoZSBmdXR1cmUAAAAAABFUaW1lc3RhbXBJbkZ1dHVyZQAAAAAAAAcAAAAvVGltZXN0YW1wIGlzIHRvbyBvbGQgb3Igbm90IHN0cmljdGx5IGluY3JlYXNpbmcAAAAAD1RpbWVzdGFtcFRvb09sZAAAAAAI",
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAAAgAAAAEAAAAAAAAABlByaWNlcwAAAAAAAQAAB9AAAAAFQXNzZXQAAAAAAAABAAAAAAAAAAxUb2tlblRvQXNzZXQAAAABAAAAEw==",
        "AAAAAQAAAAAAAAAAAAAAEFJXQU9yYWNsZVN0b3JhZ2UAAAAIAAAAAAAAAAthc3NldF90eXBlcwAAAAPsAAAH0AAAAAVBc3NldAAAAAAAB9AAAAAMUldBQXNzZXRUeXBlAAAAAAAAAAZhc3NldHMAAAAAA+oAAAfQAAAABUFzc2V0AAAAAAAAAAAAAARiYXNlAAAH0AAAAAVBc3NldAAAAAAAAAAAAAAIZGVjaW1hbHMAAAAEAAAAAAAAAA5sYXN0X3RpbWVzdGFtcAAAAAAABgAAAAAAAAANbWF4X3N0YWxlbmVzcwAAAAAAAAYAAAAAAAAACnJlc29sdXRpb24AAAAAAAQAAAAAAAAADHJ3YV9tZXRhZGF0YQAAA+wAAAARAAAH0AAAAAtSV0FNZXRhZGF0YQA=",
        "AAAAAAAAAAAAAAAEYmFzZQAAAAAAAAABAAAH0AAAAAVBc3NldAAAAA==",
        "AAAAAAAAAAAAAAAFcHJpY2UAAAAAAAACAAAAAAAAAAVhc3NldAAAAAAAB9AAAAAFQXNzZXQAAAAAAAAAAAAACXRpbWVzdGFtcAAAAAAAAAYAAAABAAAD6AAAB9AAAAAJUHJpY2VEYXRhAAAA",
        "AAAAAAAAAAAAAAAGYXNzZXRzAAAAAAAAAAAAAQAAA+oAAAfQAAAABUFzc2V0AAAA",
        "AAAAAAAAAAAAAAAGcHJpY2VzAAAAAAACAAAAAAAAAAVhc3NldAAAAAAAB9AAAAAFQXNzZXQAAAAAAAAAAAAAB3JlY29yZHMAAAAABAAAAAEAAAPoAAAD6gAAB9AAAAAJUHJpY2VEYXRhAAAA",
        "AAAAAAAAACBVcGdyYWRlIHRoZSBjb250cmFjdCB0byBuZXcgd2FzbQAAAAd1cGdyYWRlAAAAAAEAAAAAAAAADW5ld193YXNtX2hhc2gAAAAAAAPuAAAAIAAAAAA=",
        "AAAAAAAAAAAAAAAIZGVjaW1hbHMAAAAAAAAAAQAAAAQ=",
        "AAAAAAAAAAAAAAAJbGFzdHByaWNlAAAAAAAAAQAAAAAAAAAFYXNzZXQAAAAAAAfQAAAABUFzc2V0AAAAAAAAAQAAA+gAAAfQAAAACVByaWNlRGF0YQAAAA==",
        "AAAAAAAAAAAAAAAKYWRkX2Fzc2V0cwAAAAAAAQAAAAAAAAAGYXNzZXRzAAAAAAPqAAAH0AAAAAVBc3NldAAAAAAAAAA=",
        "AAAAAAAAAAAAAAAKcmVzb2x1dGlvbgAAAAAAAAAAAAEAAAAE",
        "AAAAAAAAAAAAAAANX19jb25zdHJ1Y3RvcgAAAAAAAAUAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAGYXNzZXRzAAAAAAPqAAAH0AAAAAVBc3NldAAAAAAAAAAAAAAEYmFzZQAAB9AAAAAFQXNzZXQAAAAAAAAAAAAACGRlY2ltYWxzAAAABAAAAAAAAAAKcmVzb2x1dGlvbgAAAAAABAAAAAEAAAPpAAAD7QAAAAAAAAAD",
        "AAAAAAAAAC9HZXQgdGhlIGNvbmZpZ3VyZWQgbWF4aW11bSBzdGFsZW5lc3MgaW4gc2Vjb25kcwAAAAANbWF4X3N0YWxlbmVzcwAAAAAAAAAAAAABAAAABg==",
        "AAAAAAAAAAAAAAAPc2V0X2Fzc2V0X3ByaWNlAAAAAAMAAAAAAAAACGFzc2V0X2lkAAAH0AAAAAVBc3NldAAAAAAAAAAAAAAFcHJpY2UAAAAAAAALAAAAAAAAAAl0aW1lc3RhbXAAAAAAAAAGAAAAAA==",
        "AAAAAAAAACZHZXQgY29tcGxldGUgUldBIG1ldGFkYXRhIGZvciBhbiBhc3NldAAAAAAAEGdldF9yd2FfbWV0YWRhdGEAAAABAAAAAAAAAAhhc3NldF9pZAAAABEAAAABAAAD6QAAB9AAAAALUldBTWV0YWRhdGEAAAAAAw==",
        "AAAAAAAAACxSZWdpc3RlciBvciB1cGRhdGUgUldBIG1ldGFkYXRhIGZvciBhbiBhc3NldAAAABBzZXRfcndhX21ldGFkYXRhAAAAAgAAAAAAAAAIYXNzZXRfaWQAAAARAAAAAAAAAAhtZXRhZGF0YQAAB9AAAAALUldBTWV0YWRhdGEAAAAAAQAAA+kAAAPtAAAAAAAAAAM=",
        "AAAAAAAAADpTZXQgdGhlIG1heGltdW0gYWNjZXB0YWJsZSBhZ2UgKGluIHNlY29uZHMpIGZvciBwcmljZSBkYXRhAAAAAAARc2V0X21heF9zdGFsZW5lc3MAAAAAAAABAAAAAAAAAAttYXhfc2Vjb25kcwAAAAAGAAAAAA==",
        "AAAAAAAAACBHZXQgYWxsIHJlZ2lzdGVyZWQgUldBIGFzc2V0IElEcwAAABJnZXRfYWxsX3J3YV9hc3NldHMAAAAAAAAAAAABAAAD6gAAABE=",
        "AAAAAAAAAB9HZXQgUldBIGFzc2V0IHR5cGUgZm9yIGFuIGFzc2V0AAAAABJnZXRfcndhX2Fzc2V0X3R5cGUAAAAAAAEAAAAAAAAABWFzc2V0AAAAAAAH0AAAAAVBc3NldAAAAAAAAAEAAAPoAAAH0AAAAAxSV0FBc3NldFR5cGU=",
        "AAAAAAAAACdHZXQgdG9rZW5pemF0aW9uIGluZm9ybWF0aW9uIGZvciBhbiBSV0EAAAAAFWdldF90b2tlbml6YXRpb25faW5mbwAAAAAAAAEAAAAAAAAACGFzc2V0X2lkAAAAEQAAAAEAAAPpAAAH0AAAABBUb2tlbml6YXRpb25JbmZvAAAAAw==",
        "AAAAAAAAAD9SZXNvbHZlIGEgdG9rZW4gY29udHJhY3QgYWRkcmVzcyB0byBpdHMgb3JhY2xlIGFzc2V0IGlkZW50aWZpZXIAAAAAF2dldF9hc3NldF9pZF9mcm9tX3Rva2VuAAAAAAEAAAAAAAAADXRva2VuX2FkZHJlc3MAAAAAAAATAAAAAQAAA+kAAAARAAAAAw==",
        "AAAAAAAAAEFVcGRhdGUgdG9rZW5pemF0aW9uIGluZm9ybWF0aW9uIGZvciBhIHByZXZpb3VzbHkgcmVnaXN0ZXJlZCBhc3NldAAAAAAAABh1cGRhdGVfdG9rZW5pemF0aW9uX2luZm8AAAACAAAAAAAAAAhhc3NldF9pZAAAABEAAAAAAAAAEXRva2VuaXphdGlvbl9pbmZvAAAAAAAH0AAAABBUb2tlbml6YXRpb25JbmZvAAAAAQAAA+kAAAPtAAAAAAAAAAM=",
      ]),
      options
    );
  }
  public readonly fromJSON = {
    base: this.txFromJSON<Asset>,
    price: this.txFromJSON<Option<PriceData>>,
    assets: this.txFromJSON<Array<Asset>>,
    prices: this.txFromJSON<Option<Array<PriceData>>>,
    upgrade: this.txFromJSON<null>,
    decimals: this.txFromJSON<u32>,
    lastprice: this.txFromJSON<Option<PriceData>>,
    add_assets: this.txFromJSON<null>,
    resolution: this.txFromJSON<u32>,
    max_staleness: this.txFromJSON<u64>,
    set_asset_price: this.txFromJSON<null>,
    get_rwa_metadata: this.txFromJSON<Result<RWAMetadata>>,
    set_rwa_metadata: this.txFromJSON<Result<void>>,
    set_max_staleness: this.txFromJSON<null>,
    get_all_rwa_assets: this.txFromJSON<Array<string>>,
    get_rwa_asset_type: this.txFromJSON<Option<RWAAssetType>>,
    get_tokenization_info: this.txFromJSON<Result<TokenizationInfo>>,
    get_asset_id_from_token: this.txFromJSON<Result<string>>,
    update_tokenization_info: this.txFromJSON<Result<void>>,
  };
}
