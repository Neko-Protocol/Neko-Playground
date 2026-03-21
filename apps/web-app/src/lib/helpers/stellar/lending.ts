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
 * Get the backstop token contract address configured in the lending pool.
 * Returns null if no backstop token has been set by the admin.
 */
export const getBackstopToken = async (
  contractId: string = networks.testnet.contractId
): Promise<string | null> => {
  try {
    const sorobanServer = new rpc.Server(rpcUrl, {
      allowHttp: stellarNetwork === "LOCAL",
    });
    const lendingContract = new Contract(contractId);

    const operation = lendingContract.call("get_backstop_token");

    // Simulation-only: use a known dummy source (sequence 0, no real account needed)
    const dummyAccount = new Account(
      "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
      "0"
    );

    const transaction = new TransactionBuilder(dummyAccount, {
      fee: "100",
      networkPassphrase: networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(300)
      .build();

    const simResult = await sorobanServer.simulateTransaction(transaction);
    if ("error" in simResult) return null;

    const retval = (simResult as rpc.Api.SimulateTransactionSuccessResponse)
      .result?.retval;
    if (!retval) return null;

    // Option<Address>: scvVoid = None, scvAddress = Some(addr)
    if (retval.switch().name === "scvVoid") return null;
    if (retval.switch().name === "scvAddress") {
      return Address.fromScVal(retval).toString();
    }

    return null;
  } catch (error) {
    console.error("Error getting backstop token:", error);
    return null;
  }
};

export interface BackstopDepositInfo {
  amount: bigint;
  depositedAt: bigint;
  inWithdrawalQueue: boolean;
  queuedAt: bigint | null;
}

/**
 * Get the backstop deposit info for a depositor from the lending pool.
 */
export const getBackstopDeposit = async (
  depositorAddress: string,
  contractId: string = networks.testnet.contractId
): Promise<BackstopDepositInfo> => {
  const empty: BackstopDepositInfo = {
    amount: 0n,
    depositedAt: 0n,
    inWithdrawalQueue: false,
    queuedAt: null,
  };

  try {
    const sorobanServer = new rpc.Server(rpcUrl, {
      allowHttp: stellarNetwork === "LOCAL",
    });
    const lendingContract = new Contract(contractId);

    const operation = lendingContract.call(
      "get_backstop_deposit",
      new Address(depositorAddress).toScVal()
    );

    const horizonServer = new Horizon.Server(horizonUrl);
    const account = await horizonServer.loadAccount(depositorAddress);

    const transaction = new TransactionBuilder(account, {
      fee: "100",
      networkPassphrase: networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(300)
      .build();

    const simResult = await sorobanServer.simulateTransaction(transaction);
    if ("error" in simResult) return empty;

    const retval = (simResult as rpc.Api.SimulateTransactionSuccessResponse)
      .result?.retval;
    if (!retval) return empty;

    // BackstopDeposit is a struct encoded as scvMap
    if (retval.switch().name !== "scvMap") return empty;

    const mapEntries = retval.map();
    if (!mapEntries) return empty;

    const get = (key: string): xdr.ScVal | undefined =>
      mapEntries
        .find((e) => {
          const k = e.key();
          return k.switch().name === "scvSymbol" && k.sym().toString() === key;
        })
        ?.val();

    const amountVal = get("amount");
    const depositedAtVal = get("deposited_at");
    const inQueueVal = get("in_withdrawal_queue");
    const queuedAtVal = get("queued_at");

    const parseI128 = (val: xdr.ScVal | undefined): bigint => {
      if (!val) return 0n;
      try {
        const parts = val.i128();
        const hi = BigInt(parts.hi().toString());
        const lo = BigInt(parts.lo().toString());
        return hi >= 0n ? (hi << 64n) | lo : 0n;
      } catch {
        return 0n;
      }
    };

    const parseU64 = (val: xdr.ScVal | undefined): bigint => {
      if (!val) return 0n;
      try {
        return BigInt(val.u64().toString());
      } catch {
        return 0n;
      }
    };

    const parseOptionU64 = (val: xdr.ScVal | undefined): bigint | null => {
      if (!val) return null;
      if (val.switch().name === "scvVoid") return null;
      return parseU64(val);
    };

    return {
      amount: parseI128(amountVal),
      depositedAt: parseU64(depositedAtVal),
      inWithdrawalQueue:
        inQueueVal?.switch().name === "scvBool" ? inQueueVal.b() : false,
      queuedAt: parseOptionU64(queuedAtVal),
    };
  } catch (error) {
    console.error("Error getting backstop deposit:", error);
    return empty;
  }
};

export const depositToBackstop = async (
  amount: string,
  walletAddress: string,
  contractId: string = networks.testnet.contractId
): Promise<string> => {
  try {
    const sorobanServer = new rpc.Server(rpcUrl, {
      allowHttp: stellarNetwork === "LOCAL",
    });
    const horizonServer = new Horizon.Server(horizonUrl);
    const lendingContract = new Contract(contractId);

    const amountInSmallestUnit = BigInt(toSmallestUnit(amount, 7));

    const operation = lendingContract.call(
      "deposit_to_backstop",
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
    console.error("Error building deposit_to_backstop transaction:", error);
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
  contractId: string = networks.testnet.contractId
): Promise<string> => {
  try {
    const sorobanServer = new rpc.Server(rpcUrl, {
      allowHttp: stellarNetwork === "LOCAL",
    });
    const horizonServer = new Horizon.Server(horizonUrl);
    const lendingContract = new Contract(contractId);

    const amountInSmallestUnit = BigInt(toSmallestUnit(amount, 7));

    const operation = lendingContract.call(
      "initiate_withdrawal",
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
    console.error("Error building initiate_withdrawal transaction:", error);
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
  contractId: string = networks.testnet.contractId
): Promise<string> => {
  try {
    const sorobanServer = new rpc.Server(rpcUrl, {
      allowHttp: stellarNetwork === "LOCAL",
    });
    const horizonServer = new Horizon.Server(horizonUrl);
    const lendingContract = new Contract(contractId);

    const amountInSmallestUnit = BigInt(toSmallestUnit(amount, 7));

    const operation = lendingContract.call(
      "withdraw_from_backstop",
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
    console.error("Error building withdraw_from_backstop transaction:", error);
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
