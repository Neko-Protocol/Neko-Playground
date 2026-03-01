/**
 * Utility functions for lending operations (deposit, withdraw, collateral, borrow)
 */

import {
  Contract,
  Address,
  TransactionBuilder,
  Horizon,
  Transaction,
  nativeToScVal,
  rpc,
  xdr,
} from "@stellar/stellar-sdk";
import { Client as RwaLendingClient, networks } from "@neko/lending";
import {
  rpcUrl,
  networkPassphrase,
  horizonUrl,
  allowHttpForSoroban,
} from "@/lib/constants/network";
import { toSmallestUnit, stringifyValue } from "../tokenUtils";
import { extractContractError } from "./contractErrors";

const LENDING_TX_FEE = "100" as const;
const LENDING_TX_TIMEOUT = 300;

/**
 * Simulate a transaction and ignore expected auth errors.
 * Auth failures during simulation are normal — the transaction isn't signed yet.
 */
async function simulateWithAuthErrorIgnore(
  sorobanServer: rpc.Server,
  transaction: Transaction
): Promise<void> {
  try {
    await sorobanServer.simulateTransaction(transaction);
  } catch (simError) {
    const errorMessage =
      simError instanceof Error ? simError.message : String(simError);
    if (
      !errorMessage.includes("Auth") &&
      !errorMessage.includes("require_auth") &&
      !errorMessage.includes("InvalidAction")
    ) {
      throw simError;
    }
  }
}

/**
 * Build a Soroban transaction from an operation, simulate it (ignoring auth
 * errors), prepare it, and return the XDR string ready for signing.
 */
async function buildAndPrepareTransaction(
  operation: xdr.Operation,
  walletAddress: string
): Promise<string> {
  const sorobanServer = new rpc.Server(rpcUrl, {
    allowHttp: allowHttpForSoroban,
  });
  const horizonServer = new Horizon.Server(horizonUrl);
  const account = await horizonServer.loadAccount(walletAddress);

  const transaction = new TransactionBuilder(account, {
    fee: LENDING_TX_FEE,
    networkPassphrase,
  })
    .addOperation(operation)
    .setTimeout(LENDING_TX_TIMEOUT)
    .build();

  await simulateWithAuthErrorIgnore(sorobanServer, transaction);

  const preparedTx = await sorobanServer.prepareTransaction(transaction);
  return preparedTx.toXDR();
}

/**
 * Approve token contract to spend tokens on behalf of the user.
 * Returns the raw (unprepared) transaction XDR since approve doesn't need simulation.
 */
export const approveToken = async (
  tokenContractAddress: string,
  spenderAddress: string,
  amount: string,
  decimals: number = 7,
  walletAddress: string
): Promise<string> => {
  try {
    const sorobanServer = new rpc.Server(rpcUrl, {
      allowHttp: allowHttpForSoroban,
    });
    const horizonServer = new Horizon.Server(horizonUrl);
    const tokenContract = new Contract(tokenContractAddress);

    const latestLedger = await sorobanServer.getLatestLedger();
    const expirationLedger = Math.min(
      latestLedger.sequence + 500000,
      2147483647
    );

    const amountInSmallestUnit = BigInt(toSmallestUnit(amount, decimals));

    const operation = tokenContract.call(
      "approve",
      new Address(walletAddress).toScVal(),
      new Address(spenderAddress).toScVal(),
      nativeToScVal(amountInSmallestUnit, { type: "i128" }),
      nativeToScVal(expirationLedger, { type: "u32" })
    );

    const account = await horizonServer.loadAccount(walletAddress);
    const transaction = new TransactionBuilder(account, {
      fee: LENDING_TX_FEE,
      networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(LENDING_TX_TIMEOUT)
      .build();

    return transaction.toXDR();
  } catch (error) {
    console.error("Error building approve transaction:", error);
    const friendlyError = extractContractError(error, "rwa-token");
    throw new Error(friendlyError);
  }
};

/**
 * Deposit tokens to the lending pool
 */
export const depositToPool = async (
  assetCode: string,
  amount: string,
  decimals: number = 7,
  walletAddress: string
): Promise<string> => {
  try {
    const lendingContract = new Contract(networks.testnet.contractId);
    const amountInSmallestUnit = BigInt(toSmallestUnit(amount, decimals));

    const operation = lendingContract.call(
      "deposit",
      new Address(walletAddress).toScVal(),
      xdr.ScVal.scvSymbol(assetCode),
      nativeToScVal(amountInSmallestUnit, { type: "i128" })
    );

    return buildAndPrepareTransaction(operation, walletAddress);
  } catch (error) {
    console.error("Error building deposit transaction:", error);
    const friendlyError = extractContractError(error, "rwa-lending");
    throw new Error(friendlyError);
  }
};

/**
 * Withdraw tokens from the lending pool
 */
export const withdrawFromPool = async (
  assetCode: string,
  bTokens: string,
  decimals: number = 7,
  walletAddress: string
): Promise<string> => {
  try {
    const lendingContract = new Contract(networks.testnet.contractId);
    const bTokensInSmallestUnit = BigInt(toSmallestUnit(bTokens, decimals));

    const operation = lendingContract.call(
      "withdraw",
      new Address(walletAddress).toScVal(),
      xdr.ScVal.scvSymbol(assetCode),
      nativeToScVal(bTokensInSmallestUnit, { type: "i128" })
    );

    return buildAndPrepareTransaction(operation, walletAddress);
  } catch (error) {
    console.error("Error building withdraw transaction:", error);
    const friendlyError = extractContractError(error, "rwa-lending");
    throw new Error(friendlyError);
  }
};

/**
 * Add collateral to the lending pool for borrowing
 */
export const addCollateral = async (
  rwaTokenAddress: string,
  amount: string,
  decimals: number = 7,
  walletAddress: string
): Promise<string> => {
  try {
    const lendingContract = new Contract(networks.testnet.contractId);
    const amountInSmallestUnit = BigInt(toSmallestUnit(amount, decimals));

    const operation = lendingContract.call(
      "add_collateral",
      new Address(walletAddress).toScVal(),
      new Address(rwaTokenAddress).toScVal(),
      nativeToScVal(amountInSmallestUnit, { type: "i128" })
    );

    return buildAndPrepareTransaction(operation, walletAddress);
  } catch (error) {
    console.error("Error building add_collateral transaction:", error);
    const friendlyError = extractContractError(error, "rwa-lending");
    throw new Error(friendlyError);
  }
};

/**
 * Borrow tokens from the lending pool
 */
export const borrowFromPool = async (
  assetCode: string,
  amount: string,
  decimals: number = 7,
  walletAddress: string
): Promise<string> => {
  try {
    const lendingContract = new Contract(networks.testnet.contractId);
    const amountInSmallestUnit = BigInt(toSmallestUnit(amount, decimals));

    const operation = lendingContract.call(
      "borrow",
      new Address(walletAddress).toScVal(),
      xdr.ScVal.scvSymbol(assetCode),
      nativeToScVal(amountInSmallestUnit, { type: "i128" })
    );

    return buildAndPrepareTransaction(operation, walletAddress);
  } catch (error) {
    console.error("Error building borrow transaction:", error);
    const friendlyError = extractContractError(error, "rwa-lending");
    throw new Error(friendlyError);
  }
};

/**
 * Get bToken balance for a user
 */
export const getBTokenBalance = async (
  assetCode: string,
  walletAddress: string,
  decimals: number = 7
): Promise<string> => {
  try {
    const client = new RwaLendingClient({
      contractId: networks.testnet.contractId,
      rpcUrl: rpcUrl,
      networkPassphrase: networkPassphrase,
      ...(allowHttpForSoroban && { allowHttp: true }),
    });

    const balanceTx = await client.get_b_token_balance(
      { lender: walletAddress, asset: assetCode },
      { simulate: true }
    );

    const balanceValue = balanceTx.result;
    if (!balanceValue) return "0";

    const balanceBigInt = BigInt(stringifyValue(balanceValue));
    const divisor = BigInt(Math.pow(10, decimals));
    const whole = balanceBigInt / divisor;
    const fractional = balanceBigInt % divisor;

    if (fractional === BigInt(0)) return whole.toString();

    const fractionalStr = fractional.toString().padStart(decimals, "0");
    const trimmedFractional = fractionalStr.replace(/0+$/, "");
    return `${whole}.${trimmedFractional}`;
  } catch (error) {
    console.error("Error getting bToken balance:", error);
    return "0";
  }
};
