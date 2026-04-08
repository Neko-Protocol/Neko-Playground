import {
  Account,
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
  Client as BackstopClient,
  networks as backstopNetworks,
} from "@neko/backstop";
import {
  rpcUrl,
  networkPassphrase,
  horizonUrl,
  stellarNetwork,
  allowHttpForSoroban,
} from "@/lib/constants/network";
import { toSmallestUnit } from "../tokenUtils";
import { extractContractError } from "./contractErrors";
import { getAvailableTokens } from "./soroswap/tokens";

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

    const latestLedger = await sorobanServer.getLatestLedger();
    const currentLedger = latestLedger.sequence;

    const expirationLedger = Math.min(
      currentLedger + 500000,
      2147483647 // Max safe u32 value (but contract may have lower limit)
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
      fee: "100",
      networkPassphrase: networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(300)
      .build();

    return transaction.toXDR();
  } catch (error) {
    console.error("Error building approve transaction:", error);
    const friendlyError = extractContractError(error, "rwa-token");
    throw new Error(friendlyError);
  }
};

export const depositToPool = async (
  assetCode: string,
  amount: string,
  decimals: number = 7,
  walletAddress: string,
  contractId: string = networks.testnet.contractId
): Promise<string> => {
  try {
    const sorobanServer = new rpc.Server(rpcUrl, {
      allowHttp: stellarNetwork === "LOCAL",
    });
    const horizonServer = new Horizon.Server(horizonUrl);
    const lendingContract = new Contract(contractId);

    const amountInSmallestUnit = BigInt(toSmallestUnit(amount, decimals));

    const assetSymbol = xdr.ScVal.scvSymbol(assetCode);

    const operation = lendingContract.call(
      "deposit",
      new Address(walletAddress).toScVal(),
      assetSymbol,
      nativeToScVal(amountInSmallestUnit, { type: "i128" })
    );

    const account = await horizonServer.loadAccount(walletAddress);

    const transaction = new TransactionBuilder(account, {
      fee: "100",
      networkPassphrase: networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(300)
      .build();

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

    const preparedTx = await sorobanServer.prepareTransaction(transaction);

    return preparedTx.toXDR();
  } catch (error) {
    console.error("Error building deposit transaction:", error);

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

export const withdrawFromPool = async (
  assetCode: string,
  bTokens: string,
  decimals: number = 7,
  walletAddress: string,
  contractId: string = networks.testnet.contractId
): Promise<string> => {
  try {
    const sorobanServer = new rpc.Server(rpcUrl, {
      allowHttp: stellarNetwork === "LOCAL",
    });
    const horizonServer = new Horizon.Server(horizonUrl);
    const lendingContract = new Contract(contractId);

    const bTokensInSmallestUnit = BigInt(toSmallestUnit(bTokens, decimals));

    const assetSymbol = xdr.ScVal.scvSymbol(assetCode);

    const operation = lendingContract.call(
      "withdraw",
      new Address(walletAddress).toScVal(),
      assetSymbol,
      nativeToScVal(bTokensInSmallestUnit, { type: "i128" })
    );

    const account = await horizonServer.loadAccount(walletAddress);

    const transaction = new TransactionBuilder(account, {
      fee: "100",
      networkPassphrase: networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(300)
      .build();

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

    const preparedTx = await sorobanServer.prepareTransaction(transaction);

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

export const addCollateral = async (
  rwaTokenAddress: string,
  amount: string,
  decimals: number = 7,
  walletAddress: string,
  contractId: string = networks.testnet.contractId
): Promise<string> => {
  try {
    const sorobanServer = new rpc.Server(rpcUrl, {
      allowHttp: stellarNetwork === "LOCAL",
    });
    const horizonServer = new Horizon.Server(horizonUrl);
    const lendingContract = new Contract(contractId);

    const amountInSmallestUnit = BigInt(toSmallestUnit(amount, decimals));

    const operation = lendingContract.call(
      "add_collateral",
      new Address(walletAddress).toScVal(),
      new Address(rwaTokenAddress).toScVal(),
      nativeToScVal(amountInSmallestUnit, { type: "i128" })
    );

    const account = await horizonServer.loadAccount(walletAddress);

    const transaction = new TransactionBuilder(account, {
      fee: "100",
      networkPassphrase: networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(300)
      .build();

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

    const preparedTx = await sorobanServer.prepareTransaction(transaction);

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

export const removeCollateral = async (
  rwaTokenAddress: string,
  amount: string,
  decimals: number = 7,
  walletAddress: string,
  contractId: string = networks.testnet.contractId
): Promise<string> => {
  try {
    const sorobanServer = new rpc.Server(rpcUrl, {
      allowHttp: stellarNetwork === "LOCAL",
    });
    const horizonServer = new Horizon.Server(horizonUrl);
    const lendingContract = new Contract(contractId);

    const amountInSmallestUnit = BigInt(toSmallestUnit(amount, decimals));

    const operation = lendingContract.call(
      "remove_collateral",
      new Address(walletAddress).toScVal(),
      new Address(rwaTokenAddress).toScVal(),
      nativeToScVal(amountInSmallestUnit, { type: "i128" })
    );

    const account = await horizonServer.loadAccount(walletAddress);

    const transaction = new TransactionBuilder(account, {
      fee: "100",
      networkPassphrase: networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(300)
      .build();

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

    const preparedTx = await sorobanServer.prepareTransaction(transaction);

    return preparedTx.toXDR();
  } catch (error) {
    console.error("Error building remove_collateral transaction:", error);
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

export const borrowFromPool = async (
  assetCode: string,
  amount: string,
  decimals: number = 7,
  walletAddress: string,
  contractId: string = networks.testnet.contractId
): Promise<string> => {
  try {
    const sorobanServer = new rpc.Server(rpcUrl, {
      allowHttp: stellarNetwork === "LOCAL",
    });
    const horizonServer = new Horizon.Server(horizonUrl);
    const lendingContract = new Contract(contractId);

    const amountInSmallestUnit = BigInt(toSmallestUnit(amount, decimals));

    const assetSymbol = xdr.ScVal.scvSymbol(assetCode);

    const operation = lendingContract.call(
      "borrow",
      new Address(walletAddress).toScVal(),
      assetSymbol,
      nativeToScVal(amountInSmallestUnit, { type: "i128" })
    );

    const account = await horizonServer.loadAccount(walletAddress);

    const transaction = new TransactionBuilder(account, {
      fee: "100",
      networkPassphrase: networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(300)
      .build();

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

    const preparedTx = await sorobanServer.prepareTransaction(transaction);

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
 * Get bToken balance for a lender (raw bigint, 7 Stellar decimals)
 */
export const repayPool = async (
  assetCode: string,
  dTokens: bigint,
  walletAddress: string,
  contractId: string = networks.testnet.contractId
): Promise<string> => {
  try {
    const sorobanServer = new rpc.Server(rpcUrl, {
      allowHttp: stellarNetwork === "LOCAL",
    });
    const horizonServer = new Horizon.Server(horizonUrl);
    const lendingContract = new Contract(contractId);

    const assetSymbol = xdr.ScVal.scvSymbol(assetCode);

    const operation = lendingContract.call(
      "repay",
      new Address(walletAddress).toScVal(),
      assetSymbol,
      nativeToScVal(dTokens, { type: "i128" })
    );

    const account = await horizonServer.loadAccount(walletAddress);

    const transaction = new TransactionBuilder(account, {
      fee: "100",
      networkPassphrase: networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(300)
      .build();

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

    const preparedTx = await sorobanServer.prepareTransaction(transaction);

    return preparedTx.toXDR();
  } catch (error) {
    console.error("Error building repay transaction:", error);
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
 * Get the SEP-41 token balance for a wallet (raw bigint, 7 Stellar decimals).
 * Used to check if the user has enough underlying asset before repaying.
 */
export const getTokenBalance = async (
  tokenContractAddress: string,
  walletAddress: string
): Promise<bigint> => {
  try {
    const sorobanServer = new rpc.Server(rpcUrl, {
      allowHttp: stellarNetwork === "LOCAL",
    });
    const horizonServer = new Horizon.Server(horizonUrl);
    const tokenContract = new Contract(tokenContractAddress);

    const operation = tokenContract.call(
      "balance",
      new Address(walletAddress).toScVal()
    );

    const account = await horizonServer.loadAccount(walletAddress);
    const transaction = new TransactionBuilder(account, {
      fee: "100",
      networkPassphrase: networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(300)
      .build();

    const simResult = await sorobanServer.simulateTransaction(transaction);
    if ("error" in simResult) return 0n;

    const retval = (simResult as rpc.Api.SimulateTransactionSuccessResponse)
      .result?.retval;
    if (!retval) return 0n;

    // token.balance returns i128 — extract hi/lo components
    const parts = retval.i128();
    const hi = BigInt(parts.hi().toString());
    const lo = BigInt(parts.lo().toString());
    return hi >= 0n ? (hi << 64n) | lo : 0n;
  } catch {
    return 0n;
  }
};

export const getBTokenBalanceRaw = async (
  assetCode: string,
  walletAddress: string,
  contractId: string = networks.testnet.contractId
): Promise<bigint> => {
  try {
    const client = new RwaLendingClient({
      contractId,
      rpcUrl: rpcUrl,
      networkPassphrase: networkPassphrase,
      ...(allowHttpForSoroban && { allowHttp: true }),
    });

    const tx = await client.get_b_token_balance(
      { lender: walletAddress, asset: assetCode },
      { simulate: true }
    );

    const value = tx.result;
    if (!value) return 0n;

    return typeof value === "bigint" ? value : BigInt(String(value));
  } catch (error) {
    console.error("Error getting bToken balance (raw):", error);
    return 0n;
  }
};

/**
 * Get dToken balance for a borrower (raw dTokens, not actual debt)
 */
export const getDTokenBalance = async (
  assetCode: string,
  walletAddress: string
): Promise<bigint> => {
  try {
    const client = new RwaLendingClient({
      contractId: networks.testnet.contractId,
      rpcUrl: rpcUrl,
      networkPassphrase: networkPassphrase,
      ...(allowHttpForSoroban && { allowHttp: true }),
    });

    const tx = await client.get_d_token_balance(
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
};

/**
 * Get dToken → underlying conversion rate (12-decimal scalar)
 */
export const getDTokenRate = async (assetCode: string): Promise<bigint> => {
  try {
    const client = new RwaLendingClient({
      contractId: networks.testnet.contractId,
      rpcUrl: rpcUrl,
      networkPassphrase: networkPassphrase,
      ...(allowHttpForSoroban && { allowHttp: true }),
    });

    const tx = await client.get_d_token_rate(
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
};

/**
 * Get the backstop token contract address configured in the backstop contract.
 * Returns null if no backstop token has been set by the admin.
 */
export const getBackstopToken = async (
  backstopContractId: string = backstopNetworks.testnet.contractId
): Promise<string | null> => {
  try {
    const client = new BackstopClient({
      contractId: backstopContractId,
      rpcUrl,
      networkPassphrase,
      ...(allowHttpForSoroban && { allowHttp: true }),
    });

    const tx = await client.get_backstop_token({ simulate: true });
    return tx.result ?? null;
  } catch (error) {
    console.error("Error getting backstop token:", error);
    return null;
  }
};

export interface BackstopDepositInfo {
  amount: bigint;
  activeAmount: bigint;
  queuedAmount: bigint;
  depositedAt: bigint;
  inWithdrawalQueue: boolean;
  queuedAt: bigint | null;
}

/**
 * Get the backstop deposit info for a depositor from the backstop contract.
 * Maps the on-chain `UserBalance { amount, q4w }` to `BackstopDepositInfo`.
 */
export const getBackstopDeposit = async (
  depositorAddress: string,
  backstopContractId: string = backstopNetworks.testnet.contractId
): Promise<BackstopDepositInfo> => {
  const empty: BackstopDepositInfo = {
    amount: 0n,
    activeAmount: 0n,
    queuedAmount: 0n,
    depositedAt: 0n,
    inWithdrawalQueue: false,
    queuedAt: null,
  };

  try {
    const client = new BackstopClient({
      contractId: backstopContractId,
      rpcUrl,
      networkPassphrase,
      ...(allowHttpForSoroban && { allowHttp: true }),
    });

    const tx = await client.get_user_balance(
      { depositor: depositorAddress },
      { simulate: true }
    );

    const balance = tx.result;
    if (!balance) return empty;

    const activeAmount =
      typeof balance.amount === "bigint"
        ? balance.amount
        : BigInt(String(balance.amount));

    const queuedTotal = (balance.q4w ?? []).reduce(
      (sum, entry) =>
        sum +
        (typeof entry.amount === "bigint"
          ? entry.amount
          : BigInt(String(entry.amount))),
      0n
    );
    const totalAmount = activeAmount + queuedTotal;

    const hasQueue = (balance.q4w ?? []).length > 0;
    const oldestEntry = hasQueue ? balance.q4w[0] : null;

    return {
      amount: totalAmount,
      activeAmount,
      queuedAmount: queuedTotal,
      depositedAt: 0n,
      inWithdrawalQueue: hasQueue,
      queuedAt: oldestEntry
        ? typeof oldestEntry.exp === "bigint"
          ? oldestEntry.exp
          : BigInt(String(oldestEntry.exp))
        : null,
    };
  } catch (error) {
    console.error("Error getting backstop deposit:", error);
    return empty;
  }
};

export const depositToBackstop = async (
  amount: string,
  walletAddress: string,
  backstopContractId: string = backstopNetworks.testnet.contractId
): Promise<string> => {
  try {
    const sorobanServer = new rpc.Server(rpcUrl, {
      allowHttp: stellarNetwork === "LOCAL",
    });
    const horizonServer = new Horizon.Server(horizonUrl);
    const backstopContract = new Contract(backstopContractId);

    const amountInSmallestUnit = BigInt(toSmallestUnit(amount, 7));

    const operation = backstopContract.call(
      "deposit",
      new Address(walletAddress).toScVal(),
      nativeToScVal(amountInSmallestUnit, { type: "i128" })
    );

    const account = await horizonServer.loadAccount(walletAddress);

    const transaction = new TransactionBuilder(account, {
      fee: "100",
      networkPassphrase: networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(300)
      .build();

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

    const preparedTx = await sorobanServer.prepareTransaction(transaction);

    return preparedTx.toXDR();
  } catch (error) {
    console.error("Error building backstop deposit transaction:", error);
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

export const initiateBackstopWithdrawal = async (
  amount: string,
  walletAddress: string,
  backstopContractId: string = backstopNetworks.testnet.contractId
): Promise<string> => {
  try {
    const sorobanServer = new rpc.Server(rpcUrl, {
      allowHttp: stellarNetwork === "LOCAL",
    });
    const horizonServer = new Horizon.Server(horizonUrl);
    const backstopContract = new Contract(backstopContractId);

    const amountInSmallestUnit = BigInt(toSmallestUnit(amount, 7));

    const operation = backstopContract.call(
      "queue_withdrawal",
      new Address(walletAddress).toScVal(),
      nativeToScVal(amountInSmallestUnit, { type: "i128" })
    );

    const account = await horizonServer.loadAccount(walletAddress);

    const transaction = new TransactionBuilder(account, {
      fee: "100",
      networkPassphrase: networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(300)
      .build();

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

    const preparedTx = await sorobanServer.prepareTransaction(transaction);

    return preparedTx.toXDR();
  } catch (error) {
    console.error("Error building queue_withdrawal transaction:", error);
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

export const withdrawFromBackstop = async (
  amount: string,
  walletAddress: string,
  backstopContractId: string = backstopNetworks.testnet.contractId
): Promise<string> => {
  try {
    const sorobanServer = new rpc.Server(rpcUrl, {
      allowHttp: stellarNetwork === "LOCAL",
    });
    const horizonServer = new Horizon.Server(horizonUrl);
    const backstopContract = new Contract(backstopContractId);

    const amountInSmallestUnit = BigInt(toSmallestUnit(amount, 7));

    const operation = backstopContract.call(
      "withdraw",
      new Address(walletAddress).toScVal(),
      nativeToScVal(amountInSmallestUnit, { type: "i128" })
    );

    const account = await horizonServer.loadAccount(walletAddress);

    const transaction = new TransactionBuilder(account, {
      fee: "100",
      networkPassphrase: networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(300)
      .build();

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

    const preparedTx = await sorobanServer.prepareTransaction(transaction);

    return preparedTx.toXDR();
  } catch (error) {
    console.error("Error building backstop withdraw transaction:", error);
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

export const getBTokenBalance = async (
  assetCode: string,
  walletAddress: string,
  decimals: number = 7,
  contractId: string = networks.testnet.contractId
): Promise<string> => {
  try {
    const client = new RwaLendingClient({
      contractId,
      rpcUrl: rpcUrl,
      networkPassphrase: networkPassphrase,
      ...(allowHttpForSoroban && { allowHttp: true }),
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
 * Check if a borrower has bad debt (debt > 0 and collateral = 0)
 */
export const hasBadDebt = async (
  borrower: string,
  contractId: string = networks.testnet.contractId
): Promise<boolean> => {
  try {
    const client = new RwaLendingClient({
      contractId,
      rpcUrl: rpcUrl,
      networkPassphrase: networkPassphrase,
      ...(allowHttpForSoroban && { allowHttp: true }),
    });

    const tx = await client.has_bad_debt({ borrower }, { simulate: true });

    return tx.result ?? false;
  } catch (error) {
    console.error("Error checking bad debt:", error);
    return false;
  }
};

/**
 * Build create_bad_debt_auction transaction XDR
 */
export const createBadDebtAuction = async (
  borrower: string,
  debtAsset: string,
  walletAddress: string,
  contractId: string = networks.testnet.contractId
): Promise<string> => {
  try {
    const sorobanServer = new rpc.Server(rpcUrl, {
      allowHttp: stellarNetwork === "LOCAL",
    });
    const horizonServer = new Horizon.Server(horizonUrl);
    const lendingContract = new Contract(contractId);

    const assetSymbol = xdr.ScVal.scvSymbol(debtAsset);

    const operation = lendingContract.call(
      "create_bad_debt_auction",
      new Address(borrower).toScVal(),
      assetSymbol
    );

    const account = await horizonServer.loadAccount(walletAddress);

    const transaction = new TransactionBuilder(account, {
      fee: "100",
      networkPassphrase: networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(300)
      .build();

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

    const preparedTx = await sorobanServer.prepareTransaction(transaction);

    return preparedTx.toXDR();
  } catch (error) {
    console.error("Error building create_bad_debt_auction transaction:", error);
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

export type FillBadDebtAuctionResult = {
  approveXdr: string;
  fillXdr: string;
};

/**
 * Build approve + fill_bad_debt_auction transaction XDRs
 * Bidder must approve lending contract to spend debt tokens, then call fill
 */
export const buildFillBadDebtAuctionXdr = async (
  auctionId: number,
  bidder: string,
  amount: string,
  debtAsset: string,
  decimals: number = 7,
  walletAddress: string,
  contractId: string = networks.testnet.contractId
): Promise<FillBadDebtAuctionResult> => {
  const tokens = getAvailableTokens();
  const debtToken = tokens[debtAsset];
  if (!debtToken?.contract) {
    throw new Error(`Debt token ${debtAsset} not found`);
  }

  const approveXdr = await approveToken(
    debtToken.contract,
    contractId,
    amount,
    decimals,
    walletAddress
  );

  try {
    const sorobanServer = new rpc.Server(rpcUrl, {
      allowHttp: stellarNetwork === "LOCAL",
    });
    const horizonServer = new Horizon.Server(horizonUrl);
    const lendingContract = new Contract(contractId);

    const amountInSmallestUnit = BigInt(toSmallestUnit(amount, decimals));

    const operation = lendingContract.call(
      "fill_bad_debt_auction",
      nativeToScVal(auctionId, { type: "u32" }),
      new Address(bidder).toScVal(),
      nativeToScVal(amountInSmallestUnit, { type: "i128" })
    );

    const account = await horizonServer.loadAccount(walletAddress);

    const transaction = new TransactionBuilder(account, {
      fee: "100",
      networkPassphrase: networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(300)
      .build();

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

    const preparedTx = await sorobanServer.prepareTransaction(transaction);

    return {
      approveXdr,
      fillXdr: preparedTx.toXDR(),
    };
  } catch (error) {
    console.error("Error building fill_bad_debt_auction transaction:", error);
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

// ---------------------------------------------------------------------------
// Bad Debt Auction — event-based queries
// ---------------------------------------------------------------------------

const BAD_DEBT_AUCTION_DURATION = 400; // blocks, from contract constants

export interface ActiveBadDebtAuction {
  auctionId: number;
  borrower: string;
  debtAsset: string;
  debtAmount: bigint;
  blocksElapsed: number;
  /** 0–100: percentage of backstop tokens received per unit paid */
  backstopBonus: number;
}

/**
 * Fetches active bad debt auctions by querying Soroban contract events.
 * Cross-references BadDebtAuctionCreatedEvent vs BadDebtAuctionFilledEvent
 * to return only auctions that haven't been filled yet.
 */
export async function getActiveBadDebtAuctions(
  contractId: string
): Promise<ActiveBadDebtAuction[]> {
  const sorobanServer = new rpc.Server(rpcUrl, {
    allowHttp: stellarNetwork === "LOCAL",
  });

  const { sequence: currentLedger } = await sorobanServer.getLatestLedger();
  // Look back enough to cover the full auction duration plus some buffer
  const startLedger = Math.max(1, currentLedger - 1500);

  const createdTopic = xdr.ScVal.scvSymbol("BadDebtAuctionCreatedEvent").toXDR(
    "base64"
  );
  const filledTopic = xdr.ScVal.scvSymbol("BadDebtAuctionFilledEvent").toXDR(
    "base64"
  );

  const [createdRes, filledRes] = await Promise.all([
    sorobanServer.getEvents({
      startLedger,
      filters: [
        {
          type: "contract",
          contractIds: [contractId],
          topics: [[createdTopic]],
        },
      ],
    }),
    sorobanServer.getEvents({
      startLedger,
      filters: [
        {
          type: "contract",
          contractIds: [contractId],
          topics: [[filledTopic]],
        },
      ],
    }),
  ]);

  // Build set of already-filled auction IDs
  const filledIds = new Set<number>();
  for (const event of filledRes.events) {
    try {
      const data = event.value.value() as unknown as Record<string, unknown>;
      const id = Number((data as { auction_id?: unknown }).auction_id ?? -1);
      if (id >= 0) filledIds.add(id);
    } catch {
      // skip unparseable events
    }
  }

  const active: ActiveBadDebtAuction[] = [];
  for (const event of createdRes.events) {
    try {
      const data = event.value.value() as unknown as Record<string, unknown>;
      const auctionId = Number(
        (data as { auction_id?: unknown }).auction_id ?? -1
      );
      if (auctionId < 0 || filledIds.has(auctionId)) continue;

      const blocksElapsed = currentLedger - Number(event.ledger);
      if (blocksElapsed >= BAD_DEBT_AUCTION_DURATION) continue;

      const backstopBonus = Math.floor(
        (blocksElapsed / BAD_DEBT_AUCTION_DURATION) * 100
      );

      active.push({
        auctionId,
        borrower: String((data as { borrower?: unknown }).borrower ?? ""),
        debtAsset: String((data as { debt_asset?: unknown }).debt_asset ?? ""),
        debtAmount: BigInt(
          String((data as { debt_amount?: unknown }).debt_amount ?? "0")
        ),
        blocksElapsed,
        backstopBonus,
      });
    } catch {
      // skip unparseable events
    }
  }

  return active;
}
