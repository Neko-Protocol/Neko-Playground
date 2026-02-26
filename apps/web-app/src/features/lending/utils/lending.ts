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
import { rpcUrl, networkPassphrase, horizonUrl } from "@/lib/constants/network";
import { toSmallestUnit } from "@/lib/helpers/stellar/tokenUtils";

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
    const sorobanServer = new rpc.Server(rpcUrl, { allowHttp: true });
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
    throw new Error(
      `Failed to build approve transaction: ${error instanceof Error ? error.message : String(error)}`
    );
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
    const sorobanServer = new rpc.Server(rpcUrl, { allowHttp: true });
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
        // If it's not an auth error, re-throw it
        throw simError;
      }
      // Otherwise, continue - auth will be checked when transaction is signed
    }

    // Prepare the transaction with the simulation results
    const preparedTx = await sorobanServer.prepareTransaction(transaction);

    // Return the prepared XDR for signing
    return preparedTx.toXDR();
  } catch (error) {
    console.error("Error building deposit transaction:", error);
    throw new Error(
      `Failed to build deposit transaction: ${error instanceof Error ? error.message : String(error)}`
    );
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
    const sorobanServer = new rpc.Server(rpcUrl, { allowHttp: true });
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
        // If it's not an auth error, re-throw it
        throw simError;
      }
      // Otherwise, continue - auth will be checked when transaction is signed
    }

    // Prepare the transaction with the simulation results
    const preparedTx = await sorobanServer.prepareTransaction(transaction);

    // Return the prepared XDR for signing
    return preparedTx.toXDR();
  } catch (error) {
    console.error("Error building withdraw transaction:", error);
    throw new Error(
      `Failed to build withdraw transaction: ${error instanceof Error ? error.message : String(error)}`
    );
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
      allowHttp: true, // Allow HTTP connections for local/testnet
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

/**
 * Borrow tokens from the lending pool with collateral and approve
 * Returns three separate transactions that need to be executed sequentially:
 * 1. approve
 * 2. add_collateral
 * 3. borrow
 *
 * This is necessary because Stellar/Soroban doesn't support multiple contract
 * operations in a single transaction with prepareTransaction.
 */
export const borrowWithCollateral = async (
  rwaTokenContract: string,
  collateralAmount: string,
  collateralDecimals: number,
  assetCode: string,
  borrowAmount: string,
  borrowDecimals: number = 7,
  walletAddress: string
): Promise<{
  approveXdr: string;
  addCollateralXdr: string;
  borrowXdr: string;
}> => {
  try {
    // First two transactions: approve + add_collateral
    const { approveXdr, addCollateralXdr } = await addCollateralWithApprove(
      rwaTokenContract,
      collateralAmount,
      collateralDecimals,
      walletAddress
    );

    // Third transaction: borrow
    const borrowXdr = await borrowFromPool(
      assetCode,
      borrowAmount,
      borrowDecimals,
      walletAddress
    );

    return {
      approveXdr,
      addCollateralXdr,
      borrowXdr,
    };
  } catch (error) {
    console.error("Error building borrow with collateral transactions:", error);
    throw new Error(
      `Failed to build borrow with collateral transactions: ${error instanceof Error ? error.message : String(error)}`
    );
  }
};

/**
 * Borrow tokens from the lending pool
 * Note: Use borrowWithCollateral if you need to add collateral in the same transaction
 */
export const borrowFromPool = async (
  assetCode: string,
  amount: string,
  decimals: number = 7,
  walletAddress: string
): Promise<string> => {
  try {
    const sorobanServer = new rpc.Server(rpcUrl, { allowHttp: true });
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
        // If it's not an auth error, re-throw it
        throw simError;
      }
      // Otherwise, continue - auth will be checked when transaction is signed
    }

    // Prepare the transaction with the simulation results
    const preparedTx = await sorobanServer.prepareTransaction(transaction);

    // Return the prepared XDR for signing
    return preparedTx.toXDR();
  } catch (error) {
    console.error("Error building borrow transaction:", error);
    throw new Error(
      `Failed to build borrow transaction: ${error instanceof Error ? error.message : String(error)}`
    );
  }
};

/**
 * Get borrow limit for a user
 */
export const getBorrowLimit = async (
  walletAddress: string
): Promise<string> => {
  try {
    const client = new RwaLendingClient({
      contractId: networks.testnet.contractId,
      rpcUrl: rpcUrl,
      networkPassphrase: networkPassphrase,
      allowHttp: true, // Allow HTTP connections for local/testnet
    });

    const borrowLimitTx = await client.calculate_borrow_limit(
      { borrower: walletAddress },
      { simulate: true }
    );

    const borrowLimitResult = borrowLimitTx.result;
    if (!borrowLimitResult) {
      return "0";
    }

    // Result<i128> has structure { ok: i128 } or { err: Error }
    if ("ok" in borrowLimitResult && borrowLimitResult.ok) {
      // Borrow limit is in USD value (from oracle calculations)
      // Convert from smallest unit (assuming 7 decimals for USD)
      const limitValue = Number(borrowLimitResult.ok);
      // Since this is USD value, we can divide by 1e7 to get human-readable
      return (limitValue / 1e7).toFixed(2);
    } else {
      return "0";
    }
  } catch (error) {
    console.error("Error getting borrow limit:", error);
    return "0";
  }
};

/**
 * Add collateral with approve - returns two separate transactions
 * This is necessary because Stellar/Soroban doesn't support multiple contract
 * operations in a single transaction with prepareTransaction.
 * Returns: { approveXdr: string, addCollateralXdr: string }
 */
export const addCollateralWithApprove = async (
  rwaTokenContract: string,
  amount: string,
  decimals: number = 7,
  walletAddress: string
): Promise<{ approveXdr: string; addCollateralXdr: string }> => {
  try {
    // First transaction: approve
    const approveXdr = await approveToken(
      rwaTokenContract,
      networks.testnet.contractId,
      amount,
      decimals,
      walletAddress
    );

    // Second transaction: add_collateral
    const addCollateralXdr = await buildAddCollateralTransaction(
      rwaTokenContract,
      amount,
      decimals,
      walletAddress
    );

    return {
      approveXdr,
      addCollateralXdr,
    };
  } catch (error) {
    console.error(
      "Error building add collateral with approve transactions:",
      error
    );
    throw new Error(
      `Failed to build add collateral transactions: ${error instanceof Error ? error.message : String(error)}`
    );
  }
};

/**
 * Add RWA token collateral to the lending pool
 * Returns the XDR for the add_collateral transaction
 * Note: The caller must first approve the token before calling this
 * @deprecated Use addCollateralWithApprove instead for a single transaction
 */
export const buildAddCollateralTransaction = async (
  rwaTokenContract: string,
  amount: string,
  decimals: number = 7,
  walletAddress: string
): Promise<string> => {
  try {
    const sorobanServer = new rpc.Server(rpcUrl, { allowHttp: true });
    const horizonServer = new Horizon.Server(horizonUrl);
    const lendingContract = new Contract(networks.testnet.contractId);

    // Convert amount to smallest unit (i128)
    const amountInSmallestUnit = BigInt(toSmallestUnit(amount, decimals));

    // Build add_collateral transaction
    // Call add_collateral(borrower: Address, rwa_token: Address, amount: i128)
    const operation = lendingContract.call(
      "add_collateral",
      new Address(walletAddress).toScVal(),
      new Address(rwaTokenContract).toScVal(),
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
        // If it's not an auth error, re-throw it
        throw simError;
      }
      // Otherwise, continue - auth will be checked when transaction is signed
    }

    // Prepare the transaction with the simulation results
    const preparedTx = await sorobanServer.prepareTransaction(transaction);

    // Return the prepared XDR for signing
    return preparedTx.toXDR();
  } catch (error) {
    console.error("Error building add collateral transaction:", error);
    throw new Error(
      `Failed to build add collateral transaction: ${error instanceof Error ? error.message : String(error)}`
    );
  }
};

/**
 * Get collateral balance for a user and RWA token
 */
export const getCollateral = async (
  rwaTokenContract: string,
  walletAddress: string,
  decimals: number = 7
): Promise<string> => {
  try {
    const client = new RwaLendingClient({
      contractId: networks.testnet.contractId,
      rpcUrl: rpcUrl,
      networkPassphrase: networkPassphrase,
      allowHttp: true, // Allow HTTP connections for local/testnet
    });

    const collateralTx = await client.get_collateral(
      {
        borrower: walletAddress,
        rwa_token: rwaTokenContract,
      },
      { simulate: true }
    );

    const collateralValue = collateralTx.result;
    if (!collateralValue) {
      return "0";
    }

    // Convert from smallest unit to human-readable
    const collateralStr =
      typeof collateralValue === "bigint"
        ? collateralValue.toString()
        : typeof collateralValue === "string"
          ? collateralValue
          : String(collateralValue);

    const collateralBigInt = BigInt(collateralStr);
    const divisor = BigInt(Math.pow(10, decimals));
    const whole = collateralBigInt / divisor;
    const fractional = collateralBigInt % divisor;

    if (fractional === BigInt(0)) {
      // Format large numbers with commas for readability
      return whole.toLocaleString("en-US");
    }

    const fractionalStr = fractional.toString().padStart(decimals, "0");
    const trimmedFractional = fractionalStr.replace(/0+$/, "");
    const formattedWhole = whole.toLocaleString("en-US");
    return `${formattedWhole}.${trimmedFractional}`;
  } catch (error) {
    console.error("Error getting collateral:", error);
    return "0";
  }
};
