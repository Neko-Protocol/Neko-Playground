/**
 * Utility functions for lending operations (deposit, withdraw)
 */

import {
  Contract,
  Address,
  TransactionBuilder,
  Horizon,
  nativeToScVal,
  rpc,
  xdr,
} from "@stellar/stellar-sdk";
import { Client as RwaLendingClient, networks } from "@neko/lending";
import {
  rpcUrl,
  networkPassphrase,
  horizonUrl,
  stellarNetwork,
} from "@/lib/constants/network";
import { toSmallestUnit } from "../tokenUtils";
import { extractContractError } from "./contractErrors";

/**
 * Approve token contract to spend tokens on behalf of the user
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
      allowHttp: stellarNetwork === "LOCAL",
    });
    const horizonServer = new Horizon.Server(horizonUrl);
    const tokenContract = new Contract(tokenContractAddress);

    // Get current ledger to calculate expiration
    const latestLedger = await sorobanServer.getLatestLedger();
    const currentLedger = latestLedger.sequence;

    // Calculate expiration ledger: current + ~30 days
    // Stellar ledgers occur approximately every 5 seconds
    // 30 days = 30 * 24 * 60 * 60 / 5 = 518,400 ledgers
    // Use a safe value: current + 500,000 ledgers (~29 days)
    const expirationLedger = Math.min(
      currentLedger + 500000,
      2147483647 // Max safe u32 value (but contract may have lower limit)
    );

    // Convert amount to smallest unit
    const amountInSmallestUnit = BigInt(toSmallestUnit(amount, decimals));

    // Call approve(from: Address, spender: Address, amount: i128, expiration_ledger: u32)
    const operation = tokenContract.call(
      "approve",
      new Address(walletAddress).toScVal(),
      new Address(spenderAddress).toScVal(),
      nativeToScVal(amountInSmallestUnit, { type: "i128" }),
      nativeToScVal(expirationLedger, { type: "u32" })
    );

    // Get account for transaction
    const account = await horizonServer.loadAccount(walletAddress);

    // Build transaction
    const transaction = new TransactionBuilder(account, {
      fee: "100",
      networkPassphrase: networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(300)
      .build();

    // Return XDR for signing
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
    const sorobanServer = new rpc.Server(rpcUrl, {
      allowHttp: stellarNetwork === "LOCAL",
    });
    const horizonServer = new Horizon.Server(horizonUrl);
    const lendingContract = new Contract(networks.testnet.contractId);

    // Convert amount to smallest unit (i128)
    const amountInSmallestUnit = BigInt(toSmallestUnit(amount, decimals));

    // Convert assetCode to Symbol (ScVal)
    const assetSymbol = xdr.ScVal.scvSymbol(assetCode);

    // Call deposit(lender: Address, asset: Symbol, amount: i128)
    const operation = lendingContract.call(
      "deposit",
      new Address(walletAddress).toScVal(),
      assetSymbol,
      nativeToScVal(amountInSmallestUnit, { type: "i128" })
    );

    // Get account for transaction
    const account = await horizonServer.loadAccount(walletAddress);

    // Build transaction
    const transaction = new TransactionBuilder(account, {
      fee: "100",
      networkPassphrase: networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(300)
      .build();

    // Simulate to get footprint and resource limits (ignore auth errors)
    try {
      await sorobanServer.simulateTransaction(transaction);
    } catch (simError) {
      // Auth errors during simulation are expected since transaction isn't signed yet
      const errorMessage =
        simError instanceof Error ? simError.message : String(simError);
      if (
        !errorMessage.includes("Auth") &&
        !errorMessage.includes("require_auth") &&
        !errorMessage.includes("InvalidAction")
      ) {
        // If it's not an auth error, extract and throw a user-friendly message
        const friendlyError = extractContractError(simError, "rwa-lending");
        throw new Error(friendlyError);
      }
      // Otherwise, continue - auth will be checked when transaction is signed
    }

    // Prepare the transaction with the simulation results
    const preparedTx = await sorobanServer.prepareTransaction(transaction);

    // Return the prepared XDR for signing
    return preparedTx.toXDR();
  } catch (error) {
    console.error("Error building deposit transaction:", error);
    // If error is already a user-friendly message, re-throw it
    if (
      error instanceof Error &&
      error.message &&
      !error.message.includes("Failed to build")
    ) {
      throw error;
    }
    // Otherwise, extract contract error
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
    const sorobanServer = new rpc.Server(rpcUrl, {
      allowHttp: stellarNetwork === "LOCAL",
    });
    const horizonServer = new Horizon.Server(horizonUrl);
    const lendingContract = new Contract(networks.testnet.contractId);

    // Convert bTokens to smallest unit (i128)
    const bTokensInSmallestUnit = BigInt(toSmallestUnit(bTokens, decimals));

    // Convert assetCode to Symbol (ScVal)
    const assetSymbol = xdr.ScVal.scvSymbol(assetCode);

    // Call withdraw(lender: Address, asset: Symbol, b_tokens: i128)
    const operation = lendingContract.call(
      "withdraw",
      new Address(walletAddress).toScVal(),
      assetSymbol,
      nativeToScVal(bTokensInSmallestUnit, { type: "i128" })
    );

    // Get account for transaction
    const account = await horizonServer.loadAccount(walletAddress);

    // Build transaction
    const transaction = new TransactionBuilder(account, {
      fee: "100",
      networkPassphrase: networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(300)
      .build();

    // Simulate to get footprint and resource limits (ignore auth errors)
    try {
      await sorobanServer.simulateTransaction(transaction);
    } catch (simError) {
      // Auth errors during simulation are expected since transaction isn't signed yet
      const errorMessage =
        simError instanceof Error ? simError.message : String(simError);
      if (
        !errorMessage.includes("Auth") &&
        !errorMessage.includes("require_auth") &&
        !errorMessage.includes("InvalidAction")
      ) {
        // If it's not an auth error, extract and throw a user-friendly message
        const friendlyError = extractContractError(simError, "rwa-lending");
        throw new Error(friendlyError);
      }
      // Otherwise, continue - auth will be checked when transaction is signed
    }

    // Prepare the transaction with the simulation results
    const preparedTx = await sorobanServer.prepareTransaction(transaction);

    // Return the prepared XDR for signing
    return preparedTx.toXDR();
  } catch (error) {
    console.error("Error building withdraw transaction:", error);
    if (
      error instanceof Error &&
      error.message &&
      !error.message.includes("Failed to build")
    ) {
      throw error;
    }
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
    const sorobanServer = new rpc.Server(rpcUrl, {
      allowHttp: stellarNetwork === "LOCAL",
    });
    const horizonServer = new Horizon.Server(horizonUrl);
    const lendingContract = new Contract(networks.testnet.contractId);

    // Convert amount to smallest unit (i128)
    const amountInSmallestUnit = BigInt(toSmallestUnit(amount, decimals));

    // Call add_collateral(borrower: Address, rwa_token: Address, amount: i128)
    const operation = lendingContract.call(
      "add_collateral",
      new Address(walletAddress).toScVal(),
      new Address(rwaTokenAddress).toScVal(),
      nativeToScVal(amountInSmallestUnit, { type: "i128" })
    );

    // Get account for transaction
    const account = await horizonServer.loadAccount(walletAddress);

    // Build transaction
    const transaction = new TransactionBuilder(account, {
      fee: "100",
      networkPassphrase: networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(300)
      .build();

    // Simulate to get footprint and resource limits
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
        const friendlyError = extractContractError(simError, "rwa-lending");
        throw new Error(friendlyError);
      }
    }

    // Prepare the transaction with the simulation results
    const preparedTx = await sorobanServer.prepareTransaction(transaction);

    // Return the prepared XDR for signing
    return preparedTx.toXDR();
  } catch (error) {
    console.error("Error building add_collateral transaction:", error);
    if (
      error instanceof Error &&
      error.message &&
      !error.message.includes("Failed to build")
    ) {
      throw error;
    }
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
    const sorobanServer = new rpc.Server(rpcUrl, {
      allowHttp: stellarNetwork === "LOCAL",
    });
    const horizonServer = new Horizon.Server(horizonUrl);
    const lendingContract = new Contract(networks.testnet.contractId);

    // Convert amount to smallest unit (i128)
    const amountInSmallestUnit = BigInt(toSmallestUnit(amount, decimals));

    // Convert assetCode to Symbol (ScVal)
    const assetSymbol = xdr.ScVal.scvSymbol(assetCode);

    // Call borrow(borrower: Address, asset: Symbol, amount: i128)
    const operation = lendingContract.call(
      "borrow",
      new Address(walletAddress).toScVal(),
      assetSymbol,
      nativeToScVal(amountInSmallestUnit, { type: "i128" })
    );

    // Get account for transaction
    const account = await horizonServer.loadAccount(walletAddress);

    // Build transaction
    const transaction = new TransactionBuilder(account, {
      fee: "100",
      networkPassphrase: networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(300)
      .build();

    // Simulate to get footprint and resource limits
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
        const friendlyError = extractContractError(simError, "rwa-lending");
        throw new Error(friendlyError);
      }
    }

    // Prepare the transaction with the simulation results
    const preparedTx = await sorobanServer.prepareTransaction(transaction);

    // Return the prepared XDR for signing
    return preparedTx.toXDR();
  } catch (error) {
    console.error("Error building borrow transaction:", error);
    if (
      error instanceof Error &&
      error.message &&
      !error.message.includes("Failed to build")
    ) {
      throw error;
    }
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
    });

    const balanceTx = await client.get_b_token_balance(
      {
        lender: walletAddress,
        asset: assetCode,
      },
      { simulate: true }
    );

    const balanceValue = balanceTx.result;
    if (!balanceValue) {
      return "0";
    }

    // Convert from smallest unit to human-readable
    const balanceStr =
      typeof balanceValue === "bigint"
        ? balanceValue.toString()
        : typeof balanceValue === "string"
          ? balanceValue
          : String(balanceValue);

    const balanceBigInt = BigInt(balanceStr);
    const divisor = BigInt(Math.pow(10, decimals));
    const whole = balanceBigInt / divisor;
    const fractional = balanceBigInt % divisor;

    if (fractional === BigInt(0)) {
      return whole.toString();
    }

    const fractionalStr = fractional.toString().padStart(decimals, "0");
    const trimmedFractional = fractionalStr.replace(/0+$/, "");
    return `${whole}.${trimmedFractional}`;
  } catch (error) {
    console.error("Error getting bToken balance:", error);
    return "0";
  }
};
