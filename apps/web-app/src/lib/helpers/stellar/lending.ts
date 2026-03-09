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
  allowHttpForSoroban,
} from "@/lib/constants/network";
import { toSmallestUnit } from "../tokenUtils";
import { extractContractError } from "./contractErrors";

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
