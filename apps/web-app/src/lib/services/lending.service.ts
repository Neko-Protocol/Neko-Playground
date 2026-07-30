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
import {
  Client as RwaLendingClient,
  type PoolState,
  type InterestRateParams,
  type AssetType,
} from "@neko/lending";
import {
  rpcUrl,
  networkPassphrase,
  horizonUrl,
  allowHttpForSoroban,
} from "../constants/network";
import {
  getContracts,
  getLendingPoolContractId,
} from "../constants/contractsByNetwork";

/** Allow HTTP for Horizon when URL is http: (e.g. local dev). */
const allowHttpForHorizon =
  typeof horizonUrl === "string" && horizonUrl.startsWith("http:");
import { toSmallestUnit } from "../helpers/tokenUtils";
import {
  addCollateral as addCollateralHelper,
  removeCollateral,
  depositToBackstop,
  withdrawFromBackstop,
  borrowFromPool as borrowFromPoolHelper,
  hasBadDebt as hasBadDebtHelper,
  createBadDebtAuction as createBadDebtAuctionHelper,
  buildFillBadDebtAuctionXdr,
} from "../helpers/stellar/lending";
import { extractContractError } from "../helpers/stellar/contractErrors";

type LendingOperationResult = { xdr: string; error?: string };
type CollateralOperationResult = {
  addCollateralXdr: string;
  error?: string;
};
type BorrowWithCollateralResult = {
  addCollateralXdr: string;
  borrowXdr: string;
  error?: string;
};
type FillBadDebtAuctionResult = {
  fillXdr: string;
  error?: string;
};

export class LendingService {
  private sorobanServer: rpc.Server;
  private horizonServer: Horizon.Server;
  private lendingClient: RwaLendingClient;
  private readonly pool1ContractId: string;
  private readonly pool2ContractId: string;

  constructor() {
    const contracts = getContracts();
    this.pool1ContractId = contracts.lendingPool1;
    this.pool2ContractId = contracts.lendingPool2;
    this.sorobanServer = new rpc.Server(rpcUrl, { allowHttp: true });
    this.horizonServer = new Horizon.Server(horizonUrl, {
      allowHttp: allowHttpForHorizon,
    });
    this.lendingClient = new RwaLendingClient({
      contractId: this.pool1ContractId,
      rpcUrl: rpcUrl,
      networkPassphrase: networkPassphrase,
      ...(allowHttpForSoroban && { allowHttp: true }),
    });
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
      const lendingContract = new Contract(getLendingPoolContractId(assetCode));

      // Convert amount to smallest unit (i128)
      const amountInSmallestUnit = toSmallestUnit(amount, decimals);

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
      const lendingContract = new Contract(getLendingPoolContractId(assetCode));

      // Convert bTokens to smallest unit (i128)
      const bTokensInSmallestUnit = toSmallestUnit(bTokens, decimals);

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
      const lendingContract = new Contract(getLendingPoolContractId(assetCode));

      // Convert amount to smallest unit (i128)
      const amountInSmallestUnit = toSmallestUnit(amount, decimals);

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
   * Repay borrowed tokens by burning dTokens
   */
  async repay(
    assetCode: string,
    dTokens: bigint,
    walletAddress: string,
    contractId: string
  ): Promise<LendingOperationResult> {
    try {
      const lendingContract = new Contract(contractId);

      const assetSymbol = xdr.ScVal.scvSymbol(assetCode);

      const operation = lendingContract.call(
        "repay",
        new Address(walletAddress).toScVal(),
        assetSymbol,
        nativeToScVal(dTokens, { type: "i128" })
      );

      const account = await this.horizonServer.loadAccount(walletAddress);

      const transaction = new TransactionBuilder(account, {
        fee: "100",
        networkPassphrase: networkPassphrase,
      })
        .addOperation(operation)
        .setTimeout(300)
        .build();

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

      const preparedTx =
        await this.sorobanServer.prepareTransaction(transaction);

      return { xdr: preparedTx.toXDR() };
    } catch (error) {
      console.error("Error building repay transaction:", error);
      const friendlyError = extractContractError(error, "rwa-lending");
      return { xdr: "", error: friendlyError };
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
      const lendingContract = new Contract(getLendingPoolContractId(assetCode));

      // Convert amount to smallest unit (i128)
      const amountInSmallestUnit = toSmallestUnit(amount, decimals);

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
   * Remove RWA token collateral from the lending pool
   */
  async removeCollateral(
    rwaTokenContract: string,
    amount: string,
    decimals: number = 7,
    walletAddress: string
  ): Promise<LendingOperationResult> {
    try {
      const xdr = await removeCollateral(
        rwaTokenContract,
        amount,
        decimals,
        walletAddress
      );
      return { xdr };
    } catch (error) {
      console.error("Error building remove collateral transaction:", error);
      const friendlyError = extractContractError(error, "rwa-lending");
      return {
        xdr: "",
        error: friendlyError,
      };
    }
  }

  /**
   * Add collateral
   */
  async addCollateralPrepared(
    rwaTokenContract: string,
    amount: string,
    decimals: number = 7,
    walletAddress: string
  ): Promise<CollateralOperationResult> {
    try {
      const addCollateralResult = await this.addCollateral(
        rwaTokenContract,
        amount,
        decimals,
        walletAddress
      );

      if (addCollateralResult.error) {
        return {
          addCollateralXdr: "",
          error: addCollateralResult.error,
        };
      }

      return {
        addCollateralXdr: addCollateralResult.xdr,
      };
    } catch (error) {
      console.error("Error building add collateral transaction:", error);
      const friendlyError = extractContractError(error, "rwa-lending");
      return {
        addCollateralXdr: "",
        error: friendlyError,
      };
    }
  }

  /**
   * Borrow tokens with collateral
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
      const contractId = getLendingPoolContractId(assetCode);
      const addCollateralXdr = await addCollateralHelper(
        rwaTokenContract,
        collateralAmount,
        collateralDecimals,
        walletAddress,
        contractId
      );

      const borrowXdr = await borrowFromPoolHelper(
        assetCode,
        borrowAmount,
        borrowDecimals,
        walletAddress,
        contractId
      );

      return {
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
        addCollateralXdr: "",
        borrowXdr: "",
        error: friendlyError,
      };
    }
  }

  /**
   * Deposit tokens to the backstop (first-loss capital)
   */
  async backstopDeposit(
    amount: string,
    walletAddress: string,
    backstopContractId?: string
  ): Promise<LendingOperationResult> {
    try {
      const xdrResult = await depositToBackstop(
        amount,
        walletAddress,
        backstopContractId
      );
      return { xdr: xdrResult };
    } catch (error) {
      console.error("Error building backstop deposit transaction:", error);
      const friendlyError = extractContractError(error, "rwa-lending");
      return { xdr: "", error: friendlyError };
    }
  }

  /**
   * Withdraw tokens from the backstop (after queue period expires)
   */
  async backstopWithdraw(
    amount: string,
    walletAddress: string,
    backstopContractId?: string
  ): Promise<LendingOperationResult> {
    try {
      const xdrResult = await withdrawFromBackstop(
        amount,
        walletAddress,
        backstopContractId
      );
      return { xdr: xdrResult };
    } catch (error) {
      console.error("Error building backstop withdraw transaction:", error);
      const friendlyError = extractContractError(error, "rwa-lending");
      return { xdr: "", error: friendlyError };
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
   * Get dToken balance for a borrower (raw dTokens)
   */
  async getDTokenBalance(
    assetCode: string,
    walletAddress: string
  ): Promise<bigint> {
    try {
      const tx = await this.lendingClient.get_d_token_balance(
        { borrower: walletAddress, asset: assetCode },
        { simulate: true }
      );

      const value = tx.result;
      if (!value) return 0n;

      return typeof value === "bigint" ? value : BigInt(String(value));
    } catch (error) {
      console.error("Error getting dToken balance:", error);
      return 0n;
    }
  }

  /**
   * Get dToken → underlying conversion rate (12-decimal scalar)
   */
  async getDTokenRate(assetCode: string): Promise<bigint> {
    try {
      const tx = await this.lendingClient.get_d_token_rate(
        { asset: assetCode },
        { simulate: true }
      );

      const value = tx.result;
      if (!value) return 0n;

      return typeof value === "bigint" ? value : BigInt(String(value));
    } catch (error) {
      console.error("Error getting dToken rate:", error);
      return 0n;
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
   * Get health factor for a borrower from a specific lending contract.
   * Returns a float (7 decimals: 10_000_000 = 1.0) or null if no open position.
   */
  async getHealthFactor(
    borrower: string,
    contractId: string
  ): Promise<number | null> {
    try {
      const client = new RwaLendingClient({
        contractId,
        rpcUrl: rpcUrl,
        networkPassphrase: networkPassphrase,
        ...(allowHttpForSoroban && { allowHttp: true }),
      });

      const tx = await client.calculate_health_factor(
        { borrower },
        { simulate: true }
      );

      const result = tx.result;
      if (!result) return null;

      if (result.isOk()) {
        const raw = Number(result.unwrap());
        // u32::MAX means no active borrow (infinite health factor)
        if (raw === 4294967295) return null;
        return raw / 10_000_000;
      }

      return null;
    } catch (error) {
      console.error("Error getting health factor:", error);
      return null;
    }
  }

  /**
   * Get raw collateral bigint for a user and RWA token from a specific pool contract.
   */
  async getCollateralRaw(
    rwaTokenContract: string,
    walletAddress: string,
    contractId: string
  ): Promise<bigint> {
    try {
      const client = new RwaLendingClient({
        contractId,
        rpcUrl: rpcUrl,
        networkPassphrase: networkPassphrase,
        ...(allowHttpForSoroban && { allowHttp: true }),
      });
      const tx = await client.get_collateral(
        { borrower: walletAddress, neko_token: rwaTokenContract },
        { simulate: true }
      );
      const value = tx.result;
      if (!value) return 0n;
      return typeof value === "bigint" ? value : BigInt(String(value));
    } catch (error) {
      console.error("Error getting collateral (raw):", error);
      return 0n;
    }
  }

  /**
   * Get remaining borrow capacity in USD (7 decimals) for a specific pool.
   * Returns null when no position exists or on error.
   */
  async getBorrowLimitForPool(
    walletAddress: string,
    contractId: string
  ): Promise<number | null> {
    try {
      const client = new RwaLendingClient({
        contractId,
        rpcUrl: rpcUrl,
        networkPassphrase: networkPassphrase,
        ...(allowHttpForSoroban && { allowHttp: true }),
      });
      const tx = await client.calculate_borrow_limit(
        { borrower: walletAddress },
        { simulate: true }
      );
      const result = tx.result;
      if (!result) return null;
      if (result.isOk()) {
        return Number(result.unwrap()) / 1e7;
      }
      return null;
    } catch (error) {
      console.error("Error getting borrow limit for pool:", error);
      return null;
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
          neko_token: rwaTokenContract,
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

  // ========== Liquidations (feat/liquidatios-ui) ==========

  /**
   * Check if a borrower has bad debt (debt > 0 and collateral = 0)
   */
  async hasBadDebt(
    borrower: string,
    contractId: string
  ): Promise<boolean> {
    return hasBadDebtHelper(borrower, contractId);
  }

  /**
   * Build create_bad_debt_auction transaction
   */
  async createBadDebtAuction(
    borrower: string,
    debtAsset: string,
    walletAddress: string,
    contractId: string
  ): Promise<LendingOperationResult> {
    try {
      const xdr = await createBadDebtAuctionHelper(
        borrower,
        debtAsset,
        walletAddress,
        contractId
      );
      return { xdr };
    } catch (error) {
      console.error("Error building create bad debt auction:", error);
      const friendlyError = extractContractError(error, "rwa-lending");
      return { xdr: "", error: friendlyError };
    }
  }

  /**
   * Build fill_bad_debt_auction transaction
   */
  async fillBadDebtAuction(
    auctionId: number,
    bidder: string,
    amount: string,
    debtAsset: string,
    decimals: number = 7,
    walletAddress: string,
    contractId: string
  ): Promise<FillBadDebtAuctionResult> {
    try {
      const { fillXdr } = await buildFillBadDebtAuctionXdr(
        auctionId,
        bidder,
        amount,
        debtAsset,
        decimals,
        walletAddress,
        contractId
      );
      return { fillXdr };
    } catch (error) {
      console.error("Error building fill bad debt auction:", error);
      const friendlyError = extractContractError(error, "rwa-lending");
      return {
        fillXdr: "",
        error: friendlyError,
      };
    }
  }

  // ========== Admin Methods (dev) ==========

  private getClient(contractId: string, publicKey?: string): RwaLendingClient {
    return new RwaLendingClient({
      contractId,
      rpcUrl: rpcUrl,
      networkPassphrase: networkPassphrase,
      publicKey: publicKey ?? undefined,
      ...(allowHttpForSoroban && { allowHttp: true }),
    });
  }

  /**
   * Get pool state (read-only)
   */
  async getPoolState(contractId: string): Promise<PoolState | null> {
    try {
      const client = this.getClient(contractId);
      const tx = await client.get_pool_state({ simulate: true });
      return tx.result;
    } catch (error) {
      console.error("Error getting pool state:", error);
      return null;
    }
  }

  /**
   * Build set_pool_state transaction. Returns XDR for signing.
   */
  async setPoolState(
    state: PoolState,
    walletAddress: string,
    contractId: string
  ): Promise<LendingOperationResult> {
    try {
      const client = this.getClient(contractId, walletAddress);
      const assembled = await client.set_pool_state({ state });
      const xdrStr = assembled.toXDR();
      return { xdr: xdrStr };
    } catch (error) {
      console.error("Error building set_pool_state transaction:", error);
      const friendlyError = extractContractError(error, "rwa-lending");
      return { xdr: "", error: friendlyError };
    }
  }

  /**
   * Get treasury credit (pending fees) for an asset
   */
  async getTreasuryCredit(asset: string, contractId: string): Promise<string> {
    try {
      const client = this.getClient(contractId);
      const tx = await client.get_treasury_credit(
        { asset },
        { simulate: true }
      );
      const value = tx.result;
      if (value === null || value === undefined) return "0";
      return typeof value === "bigint" ? value.toString() : String(value);
    } catch (error) {
      console.error("Error getting treasury credit:", error);
      return "0";
    }
  }

  /**
   * Build collect_treasury_fees transaction. Returns XDR for signing.
   */
  async collectTreasuryFees(
    asset: string,
    walletAddress: string,
    contractId: string
  ): Promise<LendingOperationResult> {
    try {
      const client = this.getClient(contractId, walletAddress);
      const assembled = await client.collect_treasury_fees({ asset });
      const xdrStr = assembled.toXDR();
      return { xdr: xdrStr };
    } catch (error) {
      console.error("Error building collect_treasury_fees transaction:", error);
      const friendlyError = extractContractError(error, "rwa-lending");
      return { xdr: "", error: friendlyError };
    }
  }

  /**
   * Get collateral factor for an RWA token
   */
  async getCollateralFactor(
    rwaToken: string,
    contractId: string
  ): Promise<number> {
    try {
      const client = this.getClient(contractId);
      const tx = await client.get_collateral_factor(
        { neko_token: rwaToken },
        { simulate: true }
      );
      const value = tx.result;
      return value ? Number(value) : 0;
    } catch (error) {
      console.error("Error getting collateral factor:", error);
      return 0;
    }
  }

  /**
   * Build set_collateral_factor transaction. Returns XDR for signing.
   */
  async setCollateralFactor(
    params: {
      token: string;
      factor: number;
      asset_type: AssetType;
      symbol: string;
    },
    walletAddress: string,
    contractId: string
  ): Promise<LendingOperationResult> {
    try {
      const client = this.getClient(contractId, walletAddress);
      const assembled = await client.set_collateral_factor({
        token: params.token,
        factor: params.factor,
        asset_type: params.asset_type,
        symbol: params.symbol,
      });
      const xdrStr = assembled.toXDR();
      return { xdr: xdrStr };
    } catch (error) {
      console.error("Error building set_collateral_factor transaction:", error);
      const friendlyError = extractContractError(error, "rwa-lending");
      return { xdr: "", error: friendlyError };
    }
  }

  /**
   * Build queue_set_reserve_params transaction (7-day timelock). Returns XDR for signing.
   */
  async setInterestRateParams(
    asset: string,
    params: InterestRateParams,
    walletAddress: string,
    contractId: string
  ): Promise<LendingOperationResult> {
    try {
      const client = this.getClient(contractId, walletAddress);
      const assembled = await client.queue_set_reserve_params({
        asset,
        params,
      });
      const xdrStr = assembled.toXDR();
      return { xdr: xdrStr };
    } catch (error) {
      console.error(
        "Error building queue_set_reserve_params transaction:",
        error
      );
      const friendlyError = extractContractError(error, "rwa-lending");
      return { xdr: "", error: friendlyError };
    }
  }
}

// Export singleton instance
export const lendingService = new LendingService();
