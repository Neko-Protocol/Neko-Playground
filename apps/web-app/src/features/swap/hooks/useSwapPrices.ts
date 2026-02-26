import { useMemo } from "react";
import { useTokenPrice } from "@/hooks/useTokenPrice";
import { useEVMTokenPrice } from "@/hooks/useEVMTokenPrice";
import type { Token } from "@/lib/helpers/soroswap";
import type { EVMToken } from "@/lib/types/evmToken";

export interface SwapPrices {
  tokenInPrice: number;
  tokenOutPrice: number;
  isLoadingPrice: boolean;
  isLoadingOutPrice: boolean;
  usdValue: string;
  usdValueOut: string;
  swapValueAnalysis: {
    expectedOutput: number;
    actualOutput: number;
    differencePercent: number;
    isSuspiciouslyLow: boolean;
  } | null;
}

export function useSwapPrices(
  swapMode: "evm" | "stellar",
  amountIn: string,
  amountOut: string,
  tokenIn: Token | string | EVMToken,
  tokenOut: Token | string | EVMToken
): SwapPrices {
  // Get Stellar token prices
  const { price: stellarTokenInPrice, isLoading: isLoadingStellarPrice } =
    useTokenPrice(
      swapMode === "stellar"
        ? (tokenIn as Token | string | undefined)
        : undefined
    );
  const { price: stellarTokenOutPrice, isLoading: isLoadingStellarOutPrice } =
    useTokenPrice(
      swapMode === "stellar"
        ? (tokenOut as Token | string | undefined)
        : undefined
    );

  // Get EVM token prices
  const { price: evmTokenInPrice, isLoading: isLoadingEvmPrice } =
    useEVMTokenPrice(
      swapMode === "evm"
        ? (tokenIn as EVMToken | string | undefined)
        : undefined
    );
  const { price: evmTokenOutPrice, isLoading: isLoadingEvmOutPrice } =
    useEVMTokenPrice(
      swapMode === "evm"
        ? (tokenOut as EVMToken | string | undefined)
        : undefined
    );

  // Use the appropriate price based on swap mode
  const tokenInPrice =
    swapMode === "evm" ? evmTokenInPrice : stellarTokenInPrice;
  const tokenOutPrice =
    swapMode === "evm" ? evmTokenOutPrice : stellarTokenOutPrice;
  const isLoadingPrice =
    swapMode === "evm" ? isLoadingEvmPrice : isLoadingStellarPrice;
  const isLoadingOutPrice =
    swapMode === "evm" ? isLoadingEvmOutPrice : isLoadingStellarOutPrice;

  // Calculate USD value
  const usdValue = useMemo(() => {
    if (amountIn && parseFloat(amountIn) > 0 && tokenInPrice > 0) {
      return (parseFloat(amountIn) * tokenInPrice).toFixed(2);
    }
    return "0.00";
  }, [amountIn, tokenInPrice]);

  // Calculate USD value for output amount
  const usdValueOut = useMemo(() => {
    if (amountOut && parseFloat(amountOut) > 0 && tokenOutPrice > 0) {
      return (parseFloat(amountOut) * tokenOutPrice).toFixed(2);
    }
    return "0.00";
  }, [amountOut, tokenOutPrice]);

  // Calculate expected output based on USD prices and compare with actual output
  const swapValueAnalysis = useMemo(() => {
    if (
      !amountIn ||
      !amountOut ||
      parseFloat(amountIn) <= 0 ||
      parseFloat(amountOut) <= 0
    ) {
      return null;
    }

    if (
      !tokenInPrice ||
      !tokenOutPrice ||
      tokenInPrice <= 0 ||
      tokenOutPrice <= 0
    ) {
      return null;
    }

    const inputAmount = parseFloat(amountIn);
    const outputAmount = parseFloat(amountOut);

    // Calculate expected output based on USD price ratio
    const inputUsdValue = inputAmount * tokenInPrice;
    const expectedOutput = inputUsdValue / tokenOutPrice;

    // Calculate the difference percentage
    const differencePercent =
      ((expectedOutput - outputAmount) / expectedOutput) * 100;

    // Consider the swap suspiciously low if output is more than 10% lower than expected
    const isSuspiciouslyLow = differencePercent > 10;

    return {
      expectedOutput,
      actualOutput: outputAmount,
      differencePercent,
      isSuspiciouslyLow,
    };
  }, [amountIn, amountOut, tokenInPrice, tokenOutPrice]);

  return {
    tokenInPrice,
    tokenOutPrice,
    isLoadingPrice,
    isLoadingOutPrice,
    usdValue,
    usdValueOut,
    swapValueAnalysis,
  };
}
