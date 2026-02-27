import { useAccount, useBalance, useChainId, useGasPrice } from "wagmi";
import { useMemo } from "react";
import { formatEther, parseEther } from "viem";
import {
  mainnet,
  bsc,
  polygon,
  optimism,
  arbitrum,
  base,
  sepolia,
} from "viem/chains";

// Estimated gas limits for different operations
const GAS_LIMITS = {
  // ERC-20 approve
  approve: 50_000n,
  // Standard ERC-20 swap via CoW Protocol (includes solver execution)
  cowSwap: 300_000n,
  // EthFlow swap (includes wrapping + order creation)
  ethFlow: 150_000n,
  // Buffer multiplier for safety (1.5x)
  bufferMultiplier: 150n,
  bufferDivisor: 100n,
};

// Chain config for native symbol and minimum gas balance (aligned with wagmi.config chains)
const CHAIN_GAS_CONFIG: Record<
  number,
  { symbol: string; minGasBalance: bigint }
> = {
  [mainnet.id]: {
    symbol: mainnet.nativeCurrency.symbol,
    minGasBalance: parseEther("0.001"),
  },
  [bsc.id]: {
    symbol: bsc.nativeCurrency.symbol,
    minGasBalance: parseEther("0.005"),
  },
  [polygon.id]: {
    symbol: polygon.nativeCurrency.symbol,
    minGasBalance: parseEther("1"), // MATIC
  },
  [optimism.id]: {
    symbol: optimism.nativeCurrency.symbol,
    minGasBalance: parseEther("0.001"),
  },
  [arbitrum.id]: {
    symbol: arbitrum.nativeCurrency.symbol,
    minGasBalance: parseEther("0.001"),
  },
  [base.id]: {
    symbol: base.nativeCurrency.symbol,
    minGasBalance: parseEther("0.001"),
  },
  [sepolia.id]: {
    symbol: sepolia.nativeCurrency.symbol,
    minGasBalance: parseEther("0.001"),
  },
};

const DEFAULT_CHAIN_CONFIG = CHAIN_GAS_CONFIG[mainnet.id];

export interface GasCheckResult {
  hasEnoughGas: boolean;
  nativeBalance: string;
  nativeBalanceRaw: bigint;
  estimatedGasCost: string;
  estimatedGasCostRaw: bigint;
  nativeSymbol: string;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Hook to check if the user has enough native token balance for gas fees
 * @param isEthFlow - Whether the swap uses EthFlow (for native ETH selling)
 * @param needsApproval - Whether a token approval is needed
 * @param chainId - Optional chain ID override
 */
export const useGasCheck = (
  isEthFlow: boolean = false,
  needsApproval: boolean = false,
  chainId?: number
): GasCheckResult => {
  const { address } = useAccount();
  const connectedChainId = useChainId();
  const effectiveChainId = chainId || connectedChainId;

  // Get native token balance
  const {
    data: balance,
    isLoading: isLoadingBalance,
    error: balanceError,
    refetch,
  } = useBalance({
    address,
    chainId: effectiveChainId,
    query: {
      enabled: Boolean(address),
      refetchInterval: 15000,
      staleTime: 10000,
    },
  });

  // Get gas price
  const { data: gasPrice, isLoading: isLoadingGasPrice } = useGasPrice({
    chainId: effectiveChainId,
    query: {
      enabled: Boolean(address),
      refetchInterval: 30000,
      staleTime: 15000,
    },
  });

  // Calculate estimated gas cost
  const estimatedGasCost = useMemo(() => {
    if (!gasPrice) return 0n;

    let totalGasLimit = 0n;

    // Add approval gas if needed
    if (needsApproval) {
      totalGasLimit += GAS_LIMITS.approve;
    }

    // Add swap gas based on type
    if (isEthFlow) {
      totalGasLimit += GAS_LIMITS.ethFlow;
    } else {
      totalGasLimit += GAS_LIMITS.cowSwap;
    }

    // Apply buffer multiplier
    totalGasLimit =
      (totalGasLimit * GAS_LIMITS.bufferMultiplier) / GAS_LIMITS.bufferDivisor;

    return totalGasLimit * gasPrice;
  }, [gasPrice, isEthFlow, needsApproval]);

  // Get native token symbol and min gas from chain config
  const { symbol: nativeSymbol, minGasBalance } = useMemo(() => {
    const config = CHAIN_GAS_CONFIG[effectiveChainId] ?? DEFAULT_CHAIN_CONFIG;
    return {
      symbol: config.symbol,
      minGasBalance: config.minGasBalance,
    };
  }, [effectiveChainId]);

  // Check if user has enough gas
  const hasEnoughGas = useMemo(() => {
    if (!balance?.value) return false;

    const requiredBalance =
      estimatedGasCost > minGasBalance ? estimatedGasCost : minGasBalance;

    return balance.value >= requiredBalance;
  }, [balance?.value, estimatedGasCost, minGasBalance]);

  const isLoading = isLoadingBalance || isLoadingGasPrice;

  return {
    hasEnoughGas,
    nativeBalance: balance?.formatted || "0",
    nativeBalanceRaw: balance?.value || 0n,
    estimatedGasCost: formatEther(estimatedGasCost),
    estimatedGasCostRaw: estimatedGasCost,
    nativeSymbol,
    isLoading,
    error: balanceError ? (balanceError as Error).message : null,
    refetch,
  };
};

/**
 * Format gas balance for display with appropriate precision
 */
export const formatGasBalance = (balance: string, symbol: string): string => {
  const num = parseFloat(balance);
  if (num === 0) return `0 ${symbol}`;
  if (num < 0.0001) return `<0.0001 ${symbol}`;
  if (num < 0.01) return `${num.toFixed(4)} ${symbol}`;
  return `${num.toFixed(3)} ${symbol}`;
};
