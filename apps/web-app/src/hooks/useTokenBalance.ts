import { useQuery } from "@tanstack/react-query";
import {
  Contract,
  Address,
  rpc,
  scValToNative,
  TransactionBuilder,
  Horizon,
} from "@stellar/stellar-sdk";
import {
  rpcUrl,
  networkPassphrase,
  horizonUrl,
} from "@/lib/config/stellar.config";
import { useWallet } from "./useWallet";
import { fromSmallestUnit } from "@/lib/helpers/stellar/swapUtils";
import { getTokens, getAvailableTokens } from "@/lib/helpers/stellar/soroswap";
import { getTokenAddress } from "@/lib/helpers/stellar/soroswap";

/**
 * Get token balance by simulating contract call
 */
const getTokenBalanceFromContract = async (
  contractAddress: string,
  walletAddress: string,
  decimals: number = 7
): Promise<string> => {
  try {
    const sorobanServer = new rpc.Server(rpcUrl, { allowHttp: true });
    const horizonServer = new Horizon.Server(horizonUrl);
    const contract = new Contract(contractAddress);

    // Call balance(address) function
    const operation = contract.call(
      "balance",
      new Address(walletAddress).toScVal()
    );

    // Get account for transaction from Horizon
    let account;
    try {
      account = await horizonServer.loadAccount(walletAddress);
    } catch {
      // Account might not exist, return 0
      console.log(`Account ${walletAddress} not found for balance query`);
      return "0";
    }

    // Build transaction
    const transaction = new TransactionBuilder(account, {
      fee: "100",
      networkPassphrase: networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(300)
      .build();

    // Simulate transaction
    const simulated = await sorobanServer.simulateTransaction(transaction);

    // Extract balance from result
    const simulatedResult = simulated as
      | { result?: { retval?: unknown } }
      | null
      | undefined;
    const retval = simulatedResult?.result?.retval;
    if (!retval) {
      return "0";
    }
    // Type guard to ensure retval is ScVal - scValToNative accepts ScVal which is a complex type
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const balanceValue = scValToNative(
      retval as Parameters<typeof scValToNative>[0]
    );
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const balanceBigInt = BigInt(balanceValue);

    // Convert to human-readable format
    return fromSmallestUnit(balanceBigInt.toString(), decimals);
  } catch (error) {
    console.error(
      `Failed to get balance for contract ${contractAddress}:`,
      error
    );
    return "0";
  }
};

/**
 * Get XLM balance from Horizon balances
 */
const getXlmBalance = (
  balances: Record<string, { balance?: string } | undefined>
): string => {
  const xlmBalance = balances.xlm?.balance;
  if (xlmBalance) {
    const balance = parseFloat(xlmBalance.replace(/,/g, "") || "0");
    return balance.toString();
  }
  return "0";
};

/**
 * Get decimals for a token
 */
const getTokenDecimals = (tokenAddress: string): number => {
  const tokens = getTokens();
  const availableTokens = getAvailableTokens();

  // Check if it's XLM (current network or hardcoded testnet fallback)
  if (
    tokenAddress === tokens.XLM ||
    tokenAddress === "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC" // testnet XLM fallback
  ) {
    return 7;
  }

  // Get decimals from available tokens
  for (const [, info] of Object.entries(availableTokens)) {
    if (info.contract === tokenAddress) {
      return info.decimals || 7;
    }
  }

  // Default to 7 decimals
  return 7;
};

/**
 * Hook to get balance of a specific token
 */
export const useTokenBalance = (
  token:
    | string
    | { type: "native" | "contract"; code?: string; contract?: string }
    | undefined
) => {
  const { address, balances } = useWallet();

  // Get token address
  const tokenAddress = token ? getTokenAddress(token) : null;

  // Get current network tokens
  const tokens = getTokens();

  // Check if it's XLM (native or XLM wrapper)
  const isXlm =
    tokenAddress === tokens.XLM ||
    (typeof token !== "string" && token?.type === "native") ||
    tokenAddress === "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC"; // testnet XLM fallback

  // For Soroban tokens, use contract simulation (always call hook, but disable when XLM)
  const {
    data: contractBalance = "0",
    isLoading,
    error,
  } = useQuery<string, Error>({
    queryKey: ["tokenBalance", tokenAddress, address],
    queryFn: async () => {
      if (!tokenAddress || !address) {
        return "0";
      }

      const decimals = getTokenDecimals(tokenAddress);
      return await getTokenBalanceFromContract(tokenAddress, address, decimals);
    },
    enabled: Boolean(tokenAddress && address && !isXlm),
    refetchInterval: 10000, // Poll every 10 seconds
    staleTime: 5000, // Consider stale after 5 seconds
    retry: 2,
    throwOnError: false,
  });

  // For XLM, use Horizon balances
  if (isXlm) {
    const balance = getXlmBalance(balances);
    return {
      balance,
      isLoading: false,
      error: null,
    };
  }

  // For Soroban tokens, return contract balance
  return {
    balance: contractBalance,
    isLoading,
    error: error ? error.message : null,
  };
};
