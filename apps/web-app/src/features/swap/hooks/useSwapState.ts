import { useState, useCallback } from "react";
import type { Token } from "@/lib/helpers/stellar/soroswap";

export type SwapMode = "stellar";
export type OrderType = "swap" | "limit" | "twap";

export interface SwapState {
  isLoading: boolean;
  error: string | null;
  swapMode: SwapMode;
  orderType: OrderType;
  amountIn: string;
  amountOut: string;
  tokenIn: Token | string;
  tokenOut: Token | string;
  limitPrice: string;
  twapParts: string;
  twapFrequency: string;
  txHash: string | null;
}

export interface SwapStateActions {
  setSwapMode: (mode: SwapMode) => void;
  setOrderType: (type: OrderType) => void;
  setAmountIn: (amount: string) => void;
  setAmountOut: (amount: string) => void;
  setTokenIn: (token: Token | string) => void;
  setTokenOut: (token: Token | string) => void;
  setLimitPrice: (price: string) => void;
  setTwapParts: (parts: string) => void;
  setTwapFrequency: (frequency: string) => void;
  setTxHash: (hash: string | null) => void;
  setError: (error: string | null) => void;
  setIsLoading: (loading: boolean) => void;
  resetSwap: () => void;
  swapTokens: () => void;
}

export function useSwapState(
  defaultTokenIn: Token | string,
  defaultTokenOut: Token | string
): SwapState & SwapStateActions {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const swapMode: SwapMode = "stellar";
  const setSwapMode = (_mode: SwapMode) => {};
  const [orderType, setOrderType] = useState<OrderType>("swap");
  const [amountIn, setAmountIn] = useState<string>("");
  const [amountOut, setAmountOut] = useState<string>("0.0");
  const [tokenIn, setTokenIn] = useState<Token | string>(defaultTokenIn);
  const [tokenOut, setTokenOut] = useState<Token | string>(defaultTokenOut);

  const [limitPrice, setLimitPrice] = useState<string>("");
  const [twapParts, setTwapParts] = useState<string>("10");
  const [twapFrequency, setTwapFrequency] = useState<string>("3600");
  const [txHash, setTxHash] = useState<string | null>(null);

  const resetSwap = useCallback(() => {
    setError(null);
    setIsLoading(false);
  }, []);

  const swapTokens = useCallback(() => {
    const temp = tokenIn;
    setTokenIn(tokenOut);
    setTokenOut(temp);
    setAmountIn("");
    resetSwap();
    setTxHash(null);
  }, [tokenIn, tokenOut, resetSwap]);

  return {
    isLoading,
    error,
    swapMode,
    orderType,
    amountIn,
    amountOut,
    tokenIn,
    tokenOut,
    limitPrice,
    twapParts,
    twapFrequency,
    txHash,
    setSwapMode,
    setOrderType,
    setAmountIn,
    setAmountOut,
    setTokenIn,
    setTokenOut,
    setLimitPrice,
    setTwapParts,
    setTwapFrequency,
    setTxHash,
    setError,
    setIsLoading,
    resetSwap,
    swapTokens,
  };
}
