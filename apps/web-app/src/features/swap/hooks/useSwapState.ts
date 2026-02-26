import { useState, useCallback } from "react";
import type { Token } from "@/lib/helpers/soroswap";
import type { EVMToken } from "@/lib/types/evmToken";

export type SwapMode = "evm" | "stellar";
export type OrderType = "swap" | "limit" | "twap";

export interface SwapState {
  isLoading: boolean;
  error: string | null;
  swapMode: SwapMode;
  orderType: OrderType;
  amountIn: string;
  amountOut: string;
  tokenIn: Token | string | EVMToken;
  tokenOut: Token | string | EVMToken;
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
  setTokenIn: (token: Token | string | EVMToken) => void;
  setTokenOut: (token: Token | string | EVMToken) => void;
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
  defaultTokenIn: Token | string | EVMToken,
  defaultTokenOut: Token | string | EVMToken
): SwapState & SwapStateActions {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [swapMode, setSwapMode] = useState<SwapMode>("stellar");
  const [orderType, setOrderType] = useState<OrderType>("swap");
  const [amountIn, setAmountIn] = useState<string>("");
  const [amountOut, setAmountOut] = useState<string>("0.0");
  const [tokenIn, setTokenIn] = useState<Token | string | EVMToken>(
    defaultTokenIn
  );
  const [tokenOut, setTokenOut] = useState<Token | string | EVMToken>(
    defaultTokenOut
  );

  // Wrapper functions to ensure state updates are detected
  const setTokenInWrapper = useCallback((token: Token | string | EVMToken) => {
    console.log("setTokenInWrapper called with:", token);
    setTokenIn(token);
  }, []);

  const setTokenOutWrapper = useCallback((token: Token | string | EVMToken) => {
    console.log("setTokenOutWrapper called with:", token);
    setTokenOut(token);
  }, []);
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
