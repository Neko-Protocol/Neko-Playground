/**
 * Lending Service
 * Handles all lending/borrowing operations on Stellar network
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
  allowHttpForSoroban,
} from "../constants/network";

/** Allow HTTP for Horizon when URL is http: (e.g. local dev). */
const allowHttpForHorizon =
  typeof horizonUrl === "string" && horizonUrl.startsWith("http:");
import { toSmallestUnit } from "../helpers/tokenUtils";
import {
  approveToken,
  addCollateral,
  borrowFromPool,
} from "../helpers/stellar/lending";
import { extractContractError } from "../helpers/stellar/contractErrors";
import type {
  LendingOperationResult,
  CollateralOperationResult,
  BorrowWithCollateralResult,
} from "../types/lendingTypes";

export class LendingService {
  private sorobanServer: rpc.Server;
  private horizonServer: Horizon.Server;
  private lendingClient: RwaLendingClient;

  constructor() {
    this.sorobanServer = new rpc.Server(rpcUrl, { allowHttp: true });
    this.horizonServer = new Horizon.Server(horizonUrl, {
      allowHttp: allowHttpForHorizon,
    });
    this.lendingClient = new RwaLendingClient({
      contractId: networks.testnet.contractId,
      rpcUrl: rpcUrl,
      networkPassphrase: networkPassphrase,
      ...(allowHttpForSoroban && { allowHttp: true }),
    });
  }

  /**
   * Approve token contract to spend tokens on behalf of the user
   */
  async approveToken(
    tokenContractAddress: string,
    spenderAddress: string,
    amount: string,
    decimals: number = 7,
    walletAddress: string
  ): Promise<LendingOperationResult> {
    try {
      const tokenContract = new Contract(tokenContractAddress);

      // Get current ledger to calculate expiration
      const latestLedger = await this.sorobanServer.getLatestLedger();
      const currentLedger = latestLedger.sequence;

      // Calculate expiration ledger: current + ~30 days
      const expirationLedger = Math.min(
        currentLedger + 500000,
        2147483647 // Max safe u32 value
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
      const account = await this.horizonServer.loadAccount(walletAddress);

      // Build transaction
      const transaction = new TransactionBuilder(account, {
        fee: "100",
        networkPassphrase: networkPassphrase,
      })
        .addOperation(operation)
        .setTimeout(300)
        .build();

      // Return XDR for signing
      return { xdr: transaction.toXDR() };
    } catch (error) {
      console.error("Error building approve transaction:", error);
      const friendlyError = extractContractError(error, "rwa-token");
      return {
        xdr: "",
        error: friendlyError,
      };
    }
  }

  /**
   * Deposit tokens to the lending pool
   */
  async depositToPool(
    assetCode: string,
    amount: string,
    decimals: number = 7,
    walletAddress: string
  ): Promise<LendingOperationResult> {
    try {
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
      const account = await this.horizonServer.loadAccount(walletAddress);

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
        await this.sorobanServer.simulateTransaction(transaction);
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
      const preparedTx =
        await this.sorobanServer.prepareTransaction(transaction);

      // Return the prepared XDR for signing
      return { xdr: preparedTx.toXDR() };
    } catch (error) {
      console.error("Error building deposit transaction:", error);
      const friendlyError = extractContractError(error, "rwa-lending");
      return {
        xdr: "",
        error: friendlyError,
      };
    }
  }

  /**
   * Withdraw tokens from the lending pool
   */
  async withdrawFromPool(
    assetCode: string,
    bTokens: string,
    decimals: number = 7,
    walletAddress: string
  ): Promise<LendingOperationResult> {
    try {
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
      const account = await this.horizonServer.loadAccount(walletAddress);

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
        await this.sorobanServer.simulateTransaction(transaction);
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
      const preparedTx =
        await this.sorobanServer.prepareTransaction(transaction);

      // Return the prepared XDR for signing
      return { xdr: preparedTx.toXDR() };
    } catch (error) {
      console.error("Error building withdraw transaction:", error);
      const friendlyError = extractContractError(error, "rwa-lending");
      return {
        xdr: "",
        error: friendlyError,
      };
    }
  }

  /**
   * Borrow tokens from the lending pool
   */
  async borrowFromPool(
    assetCode: string,
    amount: string,
    decimals: number = 7,
    walletAddress: string
  ): Promise<LendingOperationResult> {
    try {
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
      const account = await this.horizonServer.loadAccount(walletAddress);

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
        await this.sorobanServer.simulateTransaction(transaction);
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
      const preparedTx =
        await this.sorobanServer.prepareTransaction(transaction);

      // Return the prepared XDR for signing
      return { xdr: preparedTx.toXDR() };
    } catch (error) {
      console.error("Error building borrow transaction:", error);
      const friendlyError = extractContractError(error, "rwa-lending");
      return {
        xdr: "",
        error: friendlyError,
      };
    }
  }

  /**
   * Add RWA token collateral to the lending pool
   */
  async addCollateral(
    rwaTokenContract: string,
    amount: string,
    decimals: number = 7,
    walletAddress: string
  ): Promise<LendingOperationResult> {
    try {
      const lendingContract = new Contract(networks.testnet.contractId);

      // Convert amount to smallest unit (i128)
      const amountInSmallestUnit = BigInt(toSmallestUnit(amount, decimals));

      // Build add_collateral transaction
      const operation = lendingContract.call(
        "add_collateral",
        new Address(walletAddress).toScVal(),
        new Address(rwaTokenContract).toScVal(),
        nativeToScVal(amountInSmallestUnit, { type: "i128" })
      );

      // Get account for transaction
      const account = await this.horizonServer.loadAccount(walletAddress);

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
        await this.sorobanServer.simulateTransaction(transaction);
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
      const preparedTx =
        await this.sorobanServer.prepareTransaction(transaction);

      // Return the prepared XDR for signing
      return { xdr: preparedTx.toXDR() };
    } catch (error) {
      console.error("Error building add collateral transaction:", error);
      const friendlyError = extractContractError(error, "rwa-lending");
      return {
        xdr: "",
        error: friendlyError,
      };
    }
  }

  /**
   * Add collateral with approve - returns two separate transactions
   */
  async addCollateralWithApprove(
    rwaTokenContract: string,
    amount: string,
    decimals: number = 7,
    walletAddress: string
  ): Promise<CollateralOperationResult> {
    try {
      // First transaction: approve
      const approveResult = await this.approveToken(
        rwaTokenContract,
        networks.testnet.contractId,
        amount,
        decimals,
        walletAddress
      );

      if (approveResult.error) {
        return {
          approveXdr: "",
          addCollateralXdr: "",
          error: approveResult.error,
        };
      }

      // Second transaction: add_collateral
      const addCollateralResult = await this.addCollateral(
        rwaTokenContract,
        amount,
        decimals,
        walletAddress
      );

      if (addCollateralResult.error) {
        return {
          approveXdr: approveResult.xdr,
          addCollateralXdr: "",
          error: addCollateralResult.error,
        };
      }

      return {
        approveXdr: approveResult.xdr,
        addCollateralXdr: addCollateralResult.xdr,
      };
    } catch (error) {
      console.error(
        "Error building add collateral with approve transactions:",
        error
      );
      const friendlyError = extractContractError(error, "rwa-lending");
      return {
        approveXdr: "",
        addCollateralXdr: "",
        error: friendlyError,
      };
    }
  }

  /**
   * Borrow tokens with collateral and approve
   */
  async borrowWithCollateral(
    rwaTokenContract: string,
    collateralAmount: string,
    collateralDecimals: number,
    assetCode: string,
    borrowAmount: string,
    borrowDecimals: number = 7,
    walletAddress: string
  ): Promise<BorrowWithCollateralResult> {
    try {
      console.log("Building borrow with collateral using helper functions...");

      // Use the existing helper functions
      const approveXdr = await approveToken(
        rwaTokenContract,
        this.lendingClient.options.contractId,
        collateralAmount,
        collateralDecimals,
        walletAddress
      );

      const addCollateralXdr = await addCollateral(
        rwaTokenContract,
        collateralAmount,
        collateralDecimals,
        walletAddress
      );

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
      console.error(
        "Error building borrow with collateral transactions:",
        error
      );
      const friendlyError = extractContractError(error, "rwa-lending");
      return {
        approveXdr: "",
        addCollateralXdr: "",
        borrowXdr: "",
        error: friendlyError,
      };
    }
  }

  /**
   * Get bToken balance for a user
   */
  async getBTokenBalance(
    assetCode: string,
    walletAddress: string,
    decimals: number = 7
  ): Promise<string> {
    try {
      const balanceTx = await this.lendingClient.get_b_token_balance(
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
  }

  /**
   * Get borrow limit for a user
   */
  async getBorrowLimit(walletAddress: string): Promise<string> {
    try {
      const borrowLimitTx = await this.lendingClient.calculate_borrow_limit(
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
  }

  /**
   * Get collateral balance for a user and RWA token
   */
  async getCollateral(
    rwaTokenContract: string,
    walletAddress: string,
    decimals: number = 7
  ): Promise<string> {
    try {
      const collateralTx = await this.lendingClient.get_collateral(
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
  }
}

// Export singleton instance
export const lendingService = new LendingService();
