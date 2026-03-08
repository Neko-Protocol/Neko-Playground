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
} from "@/lib/constants/network";
import { toSmallestUnit } from "@/lib/helpers/tokenUtils";

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
    throw new Error(
      `Failed to build approve transaction: ${error instanceof Error ? error.message : String(error)}`
    );
  }
};

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
        throw simError;
      }
    }

    const preparedTx = await sorobanServer.prepareTransaction(transaction);

    return preparedTx.toXDR();
  } catch (error) {
    console.error("Error building deposit transaction:", error);
    throw new Error(
      `Failed to build deposit transaction: ${error instanceof Error ? error.message : String(error)}`
    );
  }
};

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
        throw simError;
      }
    }

    const preparedTx = await sorobanServer.prepareTransaction(transaction);

    return preparedTx.toXDR();
  } catch (error) {
    console.error("Error building withdraw transaction:", error);
    throw new Error(
      `Failed to build withdraw transaction: ${error instanceof Error ? error.message : String(error)}`
    );
  }
};

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
    const { approveXdr, addCollateralXdr } = await addCollateralWithApprove(
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
    console.error("Error building borrow with collateral transactions:", error);
    throw new Error(
      `Failed to build borrow with collateral transactions: ${error instanceof Error ? error.message : String(error)}`
    );
  }
};

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
        throw simError;
      }
    }

    const preparedTx = await sorobanServer.prepareTransaction(transaction);

    return preparedTx.toXDR();
  } catch (error) {
    console.error("Error building borrow transaction:", error);
    throw new Error(
      `Failed to build borrow transaction: ${error instanceof Error ? error.message : String(error)}`
    );
  }
};

export const getBorrowLimit = async (
  walletAddress: string
): Promise<string> => {
  try {
    const client = new RwaLendingClient({
      contractId: networks.testnet.contractId,
      rpcUrl: rpcUrl,
      networkPassphrase: networkPassphrase,
      ...(allowHttpForSoroban && { allowHttp: true }),
    });

    const borrowLimitTx = await client.calculate_borrow_limit(
      { borrower: walletAddress },
      { simulate: true }
    );

    const borrowLimitResult = borrowLimitTx.result;
    if (!borrowLimitResult) {
      return "0";
    }

    if ("ok" in borrowLimitResult && borrowLimitResult.ok) {
      const limitValue = Number(borrowLimitResult.ok);

      return (limitValue / 1e7).toFixed(2);
    } else {
      return "0";
    }
  } catch (error) {
    console.error("Error getting borrow limit:", error);
    return "0";
  }
};

export const addCollateralWithApprove = async (
  rwaTokenContract: string,
  amount: string,
  decimals: number = 7,
  walletAddress: string
): Promise<{ approveXdr: string; addCollateralXdr: string }> => {
  try {
    const approveXdr = await approveToken(
      rwaTokenContract,
      networks.testnet.contractId,
      amount,
      decimals,
      walletAddress
    );

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

    const amountInSmallestUnit = BigInt(toSmallestUnit(amount, decimals));

    const operation = lendingContract.call(
      "add_collateral",
      new Address(walletAddress).toScVal(),
      new Address(rwaTokenContract).toScVal(),
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
        throw simError;
      }
    }

    const preparedTx = await sorobanServer.prepareTransaction(transaction);

    return preparedTx.toXDR();
  } catch (error) {
    console.error("Error building add collateral transaction:", error);
    throw new Error(
      `Failed to build add collateral transaction: ${error instanceof Error ? error.message : String(error)}`
    );
  }
};

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
      ...(allowHttpForSoroban && { allowHttp: true }),
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
