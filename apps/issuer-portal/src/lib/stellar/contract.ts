import {
  Address,
  BASE_FEE,
  Contract,
  TransactionBuilder,
  nativeToScVal,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";
import { NETWORK_PASSPHRASE, XLM_SAC } from "@/lib/constants";
import { horizonServer } from "./horizon";
import { sorobanServer } from "./rpc";

function scValToBool(v: xdr.ScVal): boolean {
  return v.switch().name === "scvBool" && v.b() === true;
}

export function stroopsFromXlm(xlm: number): bigint {
  return BigInt(Math.round(xlm * 10_000_000));
}

export async function prepareOperationXdr(
  sourceAccount: string,
  buildOp: () => ReturnType<Contract["call"]>
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

export function buildListOp(
  distributorContractId: string,
  issuer: string,
  tokenContract: string,
  amount: bigint,
  pricePerTokenStroops: bigint
) {
  return () =>
    new Contract(distributorContractId).call(
      "list",
      new Address(issuer).toScVal(),
      new Address(tokenContract).toScVal(),
      nativeToScVal(amount, { type: "i128" }),
      nativeToScVal(pricePerTokenStroops, { type: "i128" })
    );
}

export function buildBuyOp(
  distributorContractId: string,
  buyer: string,
  tokenContract: string,
  tokenAmount: bigint
) {
  return () =>
    new Contract(distributorContractId).call(
      "buy",
      new Address(buyer).toScVal(),
      new Address(tokenContract).toScVal(),
      nativeToScVal(tokenAmount, { type: "i128" })
    );
}

/** Approve distributor to pull XLM (stroops) from buyer. SEP-41 token `approve`. */
export function buildApproveXlmOp(
  buyer: string,
  distributorContractId: string,
  amountStroops: bigint
) {
  return () =>
    new Contract(XLM_SAC).call(
      "approve",
      new Address(buyer).toScVal(),
      new Address(distributorContractId).toScVal(),
      nativeToScVal(amountStroops, { type: "i128" }),
      nativeToScVal(0, { type: "u32" })
    );
}

/** Simulate a single view call and return the decoded native value. */
async function simulateView<T = unknown>(
  sourceAddress: string,
  contractId: string,
  method: string
): Promise<T> {
  const account = await horizonServer.loadAccount(sourceAddress);
  const op = new Contract(contractId).call(method);
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
 * Read a SEP-41 style token contract's metadata by simulating name/symbol/decimals.
 * Source account is used only to pay sim fees (none are actually charged).
 */
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

/** Simulate `balance(address)` on a SEP-41 token. Returns base units as bigint. */
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

/** `payerAddress` pays fees (e.g. buyer); `from`/`to` are can_transfer args. */
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
