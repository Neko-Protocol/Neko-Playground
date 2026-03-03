import { useMemo } from "react";
import { useTokenPrice } from "@/hooks/useTokenPrice";
import type { Token } from "@/lib/helpers/stellar/soroswap";
import { SUSPICIOUS_VALUE_THRESHOLD_PCT } from "@/features/swap/constants/swapConfig";

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
  amountIn: string,
  amountOut: string,
  tokenIn: Token | string,
  tokenOut: Token | string
): SwapPrices {
  const { price: tokenInPrice, isLoading: isLoadingPrice } = useTokenPrice(
    tokenIn as Token | string | undefined
  );
  const { price: tokenOutPrice, isLoading: isLoadingOutPrice } = useTokenPrice(
    tokenOut as Token | string | undefined
  );

  const usdValue = useMemo(() => {
    if (amountIn && parseFloat(amountIn) > 0 && tokenInPrice > 0) {
      return (parseFloat(amountIn) * tokenInPrice).toFixed(2);
    }
    return "0.00";
  }, [amountIn, tokenInPrice]);

  const usdValueOut = useMemo(() => {
    if (amountOut && parseFloat(amountOut) > 0 && tokenOutPrice > 0) {
      return (parseFloat(amountOut) * tokenOutPrice).toFixed(2);
    }
    return "0.00";
  }, [amountOut, tokenOutPrice]);

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
    const inputUsdValue = inputAmount * tokenInPrice;
    const expectedOutput = inputUsdValue / tokenOutPrice;
    const differencePercent =
      ((expectedOutput - outputAmount) / expectedOutput) * 100;
    const isSuspiciouslyLow =
      differencePercent > SUSPICIOUS_VALUE_THRESHOLD_PCT;

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
