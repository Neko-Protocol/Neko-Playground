import { useState, useCallback } from "react";
import type { Token } from "@/lib/helpers/stellar/soroswap";

export type OrderType = "swap" | "limit" | "twap";

export interface SwapState {
  isLoading: boolean;
  orderType: OrderType;
  amountIn: string;
  amountOut: string;
  tokenIn: Token | string;
  tokenOut: Token | string;
  txHash: string | null;
}

export interface SwapStateActions {
  setOrderType: (type: OrderType) => void;
  setAmountIn: (amount: string) => void;
  setAmountOut: (amount: string) => void;
  setTokenIn: (token: Token | string) => void;
  setTokenOut: (token: Token | string) => void;
  setTxHash: (hash: string | null) => void;
  setIsLoading: (loading: boolean) => void;
  resetSwap: () => void;
  swapTokens: () => void;
}

export function useSwapState(
  defaultTokenIn: Token | string,
  defaultTokenOut: Token | string
): SwapState & SwapStateActions {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [orderType, setOrderType] = useState<OrderType>("swap");
  const [amountIn, setAmountIn] = useState<string>("");
  const [amountOut, setAmountOut] = useState<string>("0.0");
  const [tokenIn, setTokenIn] = useState<Token | string>(defaultTokenIn);
  const [tokenOut, setTokenOut] = useState<Token | string>(defaultTokenOut);
  const [txHash, setTxHash] = useState<string | null>(null);

  const resetSwap = useCallback(() => {
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
    orderType,
    amountIn,
    amountOut,
    tokenIn,
    tokenOut,
    txHash,
    setOrderType,
    setAmountIn,
    setAmountOut,
    setTokenIn,
    setTokenOut,
    setTxHash,
    setIsLoading,
    resetSwap,
    swapTokens,
  };
}
