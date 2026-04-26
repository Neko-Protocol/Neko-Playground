import {
  Address,
  Asset,
  BASE_FEE,
  Contract,
  Operation,
  StrKey,
  TransactionBuilder,
  nativeToScVal,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";
import { NETWORK_PASSPHRASE, XLM_SAC } from "@/lib/constants";
import type { OracleAsset, PricingMode } from "@/types";
import { horizonServer } from "./horizon";
import { sorobanServer } from "./rpc";

function scValToBool(v: xdr.ScVal): boolean {
  return v.switch().name === "scvBool" && v.b() === true;
}

export function stroopsFromXlm(xlm: number): bigint {
  return BigInt(Math.round(xlm * 10_000_000));
}

export function xlmFromStroops(stroops: bigint): number {
  return Number(stroops) / 10_000_000;
}

/** Build a single-op tx, prepare it through Soroban RPC, return signed-ready XDR. */
export async function prepareOperationXdr(
  sourceAccount: string,
  buildOp: () => xdr.Operation
): Promise<string> {
  const account = await horizonServer.loadAccount(sourceAccount);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(buildOp())
    .setTimeout(0)
    .build();
  const prepared = await sorobanServer.prepareTransaction(tx);
  return prepared.toXDR();
}

/** Build an N-op tx (atomic), prepare it through Soroban RPC, return signed-ready XDR. */
export async function prepareMultiOpXdr(
  sourceAccount: string,
  buildOps: Array<() => xdr.Operation>
): Promise<string> {
  if (buildOps.length === 0) throw new Error("no operations to prepare");
  const account = await horizonServer.loadAccount(sourceAccount);
  const builder = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  }).setTimeout(0);
  for (const op of buildOps) builder.addOperation(op());
  const prepared = await sorobanServer.prepareTransaction(builder.build());
  return prepared.toXDR();
}

/** SEP-41 `transfer(from, to, amount)`. */
export function buildTokenTransferOp(
  tokenContract: string,
  from: string,
  to: string,
  amountBaseUnits: bigint
): () => xdr.Operation {
  return () =>
    new Contract(tokenContract).call(
      "transfer",
      new Address(from).toScVal(),
      new Address(to).toScVal(),
      nativeToScVal(amountBaseUnits, { type: "i128" })
    );
}

/** Convert a hex digest string into ScVal `BytesN<32>`. */
function hexToBytesN32ScVal(hex: string): xdr.ScVal {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (clean.length !== 64) {
    throw new Error(`expected 32-byte hex, got ${clean.length / 2} bytes`);
  }
  const bytes = Buffer.from(clean, "hex");
  return xdr.ScVal.scvBytes(bytes);
}

function oracleAssetToScVal(asset: OracleAsset): xdr.ScVal {
  if (asset.kind === "stellar") {
    return xdr.ScVal.scvVec([
      xdr.ScVal.scvSymbol("Stellar"),
      new Address(asset.address).toScVal(),
    ]);
  }
  return xdr.ScVal.scvVec([
    xdr.ScVal.scvSymbol("Other"),
    xdr.ScVal.scvSymbol(asset.symbol),
  ]);
}

/** Serialize a `PricingMode` into the Soroban `Pricing` enum ScVal. */
export function pricingModeToScVal(pricing: PricingMode): xdr.ScVal {
  if (pricing.type === "fixed") {
    return xdr.ScVal.scvVec([
      xdr.ScVal.scvSymbol("Fixed"),
      nativeToScVal(stroopsFromXlm(pricing.priceXlm), { type: "i128" }),
    ]);
  }

  const methodSym = pricing.method === "cross" ? "CrossPrice" : "LastPrice";
  const quoteScVal: xdr.ScVal = pricing.quote
    ? xdr.ScVal.scvVec([
        xdr.ScVal.scvSymbol("Some"),
        oracleAssetToScVal(pricing.quote),
      ])
    : xdr.ScVal.scvVec([xdr.ScVal.scvSymbol("None")]);

  // Field order MUST match the Rust struct definition:
  //   oracle, method, base, quote, premium_bps, max_staleness_secs
  const cfg = xdr.ScVal.scvMap([
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("base"),
      val: oracleAssetToScVal(pricing.base),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("max_staleness_secs"),
      val: nativeToScVal(BigInt(pricing.maxStalenessSecs), { type: "u64" }),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("method"),
      val: xdr.ScVal.scvVec([xdr.ScVal.scvSymbol(methodSym)]),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("oracle"),
      val: new Address(pricing.oracleContract).toScVal(),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("premium_bps"),
      val: nativeToScVal(pricing.premiumBps, { type: "i32" }),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol("quote"),
      val: quoteScVal,
    }),
  ]);

  return xdr.ScVal.scvVec([xdr.ScVal.scvSymbol("Oracle"), cfg]);
}

/** registry.list(issuer, token, escrow_id, escrow_address, amount, pricing) */
export function buildListOp(
  registryContractId: string,
  issuer: string,
  tokenContract: string,
  escrowIdHex: string,
  escrowAddress: string,
  amountBaseUnits: bigint,
  pricing: PricingMode
): () => xdr.Operation {
  return () =>
    new Contract(registryContractId).call(
      "list",
      new Address(issuer).toScVal(),
      new Address(tokenContract).toScVal(),
      hexToBytesN32ScVal(escrowIdHex),
      new Address(escrowAddress).toScVal(),
      nativeToScVal(amountBaseUnits, { type: "i128" }),
      pricingModeToScVal(pricing)
    );
}

/** registry.buy(buyer, token, amount, max_price_per_token) */
export function buildBuyOp(
  registryContractId: string,
  buyer: string,
  tokenContract: string,
  tokenAmountBaseUnits: bigint,
  maxPricePerTokenStroops: bigint
): () => xdr.Operation {
  return () =>
    new Contract(registryContractId).call(
      "buy",
      new Address(buyer).toScVal(),
      new Address(tokenContract).toScVal(),
      nativeToScVal(tokenAmountBaseUnits, { type: "i128" }),
      nativeToScVal(maxPricePerTokenStroops, { type: "i128" })
    );
}

/**
 * @deprecated v2 charges XLM directly inside `registry.buy` — no SEP-41
 * `approve` step is needed any more. Kept exported for any caller that still
 * imports it; safe to delete in a follow-up cleanup.
 */
export function buildApproveXlmOp(
  buyer: string,
  spender: string,
  amountStroops: bigint
): () => xdr.Operation {
  return () =>
    new Contract(XLM_SAC).call(
      "approve",
      new Address(buyer).toScVal(),
      new Address(spender).toScVal(),
      nativeToScVal(amountStroops, { type: "i128" }),
      nativeToScVal(0, { type: "u32" })
    );
}

/** Simulate a single view call and return the decoded native value. */
async function simulateView<T = unknown>(
  sourceAddress: string,
  contractId: string,
  method: string,
  args: xdr.ScVal[] = []
): Promise<T> {
  const account = await horizonServer.loadAccount(sourceAddress);
  const op = new Contract(contractId).call(method, ...args);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(op)
    .setTimeout(0)
    .build();
  const sim = await sorobanServer.simulateTransaction(tx);
  if (
    typeof sim === "object" &&
    sim !== null &&
    "error" in sim &&
    (sim as { error?: string }).error
  ) {
    throw new Error(
      `simulate ${method}() failed: ${(sim as { error: string }).error}`
    );
  }
  const retval = (sim as { result?: { retval?: xdr.ScVal } }).result?.retval;
  if (!retval) throw new Error(`simulate ${method}() returned no value`);
  return scValToNative(retval) as T;
}

export interface TokenMetadata {
  name: string;
  symbol: string;
  decimals: number;
}

/**
 * Deterministic Soroban Stellar Asset Contract id (`C…`) for a classic
 * `{ assetCode, issuer }` on the configured network. Does not check that the
 * SAC is actually deployed.
 */
export function sacContractIdFromClassicIssuer(
  issuerGAddress: string,
  assetCode: string
): string {
  const issuer = issuerGAddress.trim();
  const code = assetCode.trim();
  if (!StrKey.isValidEd25519PublicKey(issuer)) {
    throw new Error("Issuer must be a valid Stellar G-address");
  }
  if (!/^[a-zA-Z0-9]{1,12}$/.test(code)) {
    throw new Error(
      "Asset code must be 1–12 alphanumeric characters (classic asset code)"
    );
  }
  const asset = new Asset(code, issuer);
  return asset.contractId(NETWORK_PASSPHRASE);
}

export async function fetchTokenMetadata(
  sourceAddress: string,
  contractId: string
): Promise<TokenMetadata> {
  const [name, symbol, decimalsRaw] = await Promise.all([
    simulateView<string>(sourceAddress, contractId, "name"),
    simulateView<string>(sourceAddress, contractId, "symbol"),
    simulateView<number | bigint>(sourceAddress, contractId, "decimals"),
  ]);
  const decimals =
    typeof decimalsRaw === "bigint" ? Number(decimalsRaw) : decimalsRaw;
  return { name, symbol, decimals };
}

export interface ResolvedClassicIssuedAsset extends TokenMetadata {
  contractId: string;
  /** False when Soroban `name/symbol/decimals` simulation failed (TW still accepts classic issuer+code). */
  readFromSac: boolean;
}

/**
 * Resolve a classic `{ issuer, assetCode }` to the deterministic SAC `C…` and
 * best-effort SEP-41 metadata. If the Soroban contract is not callable (same as
 * when Trustless Work only needs classic trustline data), falls back to
 * Horizon presence check and **7** decimals — Stellar’s default precision for
 * issued credits.
 */
export async function resolveClassicIssuedAsset(
  sourceAddress: string,
  issuerGAddress: string,
  assetCode: string
): Promise<ResolvedClassicIssuedAsset> {
  const sac = sacContractIdFromClassicIssuer(issuerGAddress, assetCode);
  const sym = assetCode.trim().toUpperCase();

  try {
    const meta = await fetchTokenMetadata(sourceAddress, sac);
    return {
      contractId: sac,
      name: meta.name,
      symbol: meta.symbol,
      decimals: meta.decimals,
      readFromSac: true,
    };
  } catch {
    /* SAC not readable — TW dapp still links by classic issuer + code */
  }

  let foundOnHorizon = false;
  try {
    const res = await horizonServer
      .assets()
      .forCode(assetCode.trim())
      .forIssuer(issuerGAddress.trim())
      .limit(1)
      .call();
    foundOnHorizon = res.records.length > 0;
  } catch {
    /* ignore */
  }

  const name = foundOnHorizon
    ? `${sym} (classic asset)`
    : `${sym} (metadata not verified on-chain)`;

  return {
    contractId: sac,
    name,
    symbol: sym,
    decimals: 7,
    readFromSac: false,
  };
}

export async function fetchTokenBalance(
  sourceAddress: string,
  contractId: string,
  holder: string
): Promise<bigint> {
  const account = await horizonServer.loadAccount(sourceAddress);
  const op = new Contract(contractId).call(
    "balance",
    new Address(holder).toScVal()
  );
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(op)
    .setTimeout(0)
    .build();
  const sim = await sorobanServer.simulateTransaction(tx);
  const retval = (sim as { result?: { retval?: xdr.ScVal } }).result?.retval;
  if (!retval) return 0n;
  const v = scValToNative(retval);
  return typeof v === "bigint" ? v : BigInt(v as number);
}

export async function simulateCanTransfer(
  payerAddress: string,
  tokenContractId: string,
  from: string,
  to: string,
  amount: bigint
): Promise<boolean> {
  const account = await horizonServer.loadAccount(payerAddress);
  const op = new Contract(tokenContractId).call(
    "can_transfer",
    new Address(from).toScVal(),
    new Address(to).toScVal(),
    nativeToScVal(amount, { type: "i128" })
  );
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(op)
    .setTimeout(0)
    .build();
  const sim = await sorobanServer.simulateTransaction(tx);
  if (
    typeof sim === "object" &&
    sim !== null &&
    "error" in sim &&
    (sim as { error?: string }).error
  ) {
    return false;
  }
  const retval = (sim as { result?: { retval?: xdr.ScVal } }).result?.retval;
  if (!retval) return false;
  return scValToBool(retval);
}

// ---------------------------------------------------------------------------
// Reflector (SEP-40) helpers
// ---------------------------------------------------------------------------

export interface OracleMetadata {
  base: OracleAsset;
  decimals: number;
  resolution: number;
}

function decodeOracleAsset(v: unknown): OracleAsset {
  if (Array.isArray(v) && v.length >= 2) {
    const [tag, payload] = v;
    if (tag === "Stellar" && typeof payload === "string") {
      return { kind: "stellar", address: payload };
    }
    if (tag === "Other" && typeof payload === "string") {
      return { kind: "other", symbol: payload };
    }
  }
  // Some sims return objects keyed by tag name.
  if (v && typeof v === "object") {
    const obj = v as Record<string, unknown>;
    if (typeof obj.Stellar === "string") {
      return { kind: "stellar", address: obj.Stellar };
    }
    if (typeof obj.Other === "string") {
      return { kind: "other", symbol: obj.Other };
    }
  }
  throw new Error("could not decode oracle asset");
}

export async function fetchOracleMetadata(
  sourceAddress: string,
  oracleContract: string
): Promise<OracleMetadata> {
  const [baseRaw, decRaw, resRaw] = await Promise.all([
    simulateView<unknown>(sourceAddress, oracleContract, "base"),
    simulateView<number | bigint>(sourceAddress, oracleContract, "decimals"),
    simulateView<number | bigint>(sourceAddress, oracleContract, "resolution"),
  ]);
  return {
    base: decodeOracleAsset(baseRaw),
    decimals: typeof decRaw === "bigint" ? Number(decRaw) : decRaw,
    resolution: typeof resRaw === "bigint" ? Number(resRaw) : resRaw,
  };
}

export interface OraclePriceSample {
  /** Raw oracle price in oracle decimals (typically 14). */
  price: bigint;
  /** Unix seconds. */
  timestamp: number;
  /** Oracle decimals. */
  decimals: number;
}

export async function simulateOraclePrice(
  sourceAddress: string,
  oracleContract: string,
  method: "lastprice" | "cross",
  base: OracleAsset,
  quote?: OracleAsset
): Promise<OraclePriceSample | null> {
  const args: xdr.ScVal[] =
    method === "lastprice"
      ? [oracleAssetToScVal(base)]
      : [oracleAssetToScVal(base), oracleAssetToScVal(quote!)];
  const fnName = method === "lastprice" ? "lastprice" : "x_last_price";

  let priceData: {
    price?: bigint | number;
    timestamp?: bigint | number;
  } | null;
  try {
    priceData = await simulateView<typeof priceData>(
      sourceAddress,
      oracleContract,
      fnName,
      args
    );
  } catch (err) {
    throw new Error(
      `oracle ${fnName} simulate failed: ${(err as Error).message}`
    );
  }
  if (!priceData || priceData.price === undefined) return null;

  const decimals = await simulateView<number | bigint>(
    sourceAddress,
    oracleContract,
    "decimals"
  );
  return {
    price:
      typeof priceData.price === "bigint"
        ? priceData.price
        : BigInt(priceData.price),
    timestamp:
      typeof priceData.timestamp === "bigint"
        ? Number(priceData.timestamp)
        : Number(priceData.timestamp ?? 0),
    decimals: typeof decimals === "bigint" ? Number(decimals) : decimals,
  };
}

/**
 * Convert a raw Reflector price (in oracle decimals) into XLM stroops per
 * token base unit, applying a basis-points premium/discount.
 */
export function applyPricingNormalization(
  rawOraclePrice: bigint,
  oracleDecimals: number,
  premiumBps: number
): bigint {
  const stroopDec = 7;
  let raw: bigint;
  if (oracleDecimals >= stroopDec) {
    const div = 10n ** BigInt(oracleDecimals - stroopDec);
    raw = rawOraclePrice / div;
  } else {
    const mul = 10n ** BigInt(stroopDec - oracleDecimals);
    raw = rawOraclePrice * mul;
  }
  return raw + (raw * BigInt(premiumBps)) / 10_000n;
}

export type { Operation };
