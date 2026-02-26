import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { usePublicClient, useWalletClient } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import type { Token } from "@/lib/helpers/soroswap";
import { isEVMToken, type EVMToken } from "@/lib/types/evmToken";
import { hasApiKey, getQuote, type QuoteRequest } from "@/lib/helpers/soroswap";
import {
  getCowSwapQuote,
  type CowSwapQuoteRequest,
} from "@/lib/helpers/cowswap";
import { getTokensForChain } from "@/lib/constants/evmConfig";
import { formatSwapAmount, fromSmallestUnit } from "@/lib/helpers/swapUtils";
import { QUOTE_TIMEOUT_MS } from "@/lib/constants/cowswapConfig";

export interface SwapQuoteState {
  amountOut: string;
  isLoadingQuote: boolean;
  apiKeyConfigured: boolean;
}

export interface SwapQuoteActions {
  fetchLiveQuote: () => Promise<void>;
}

export function useSwapQuote(
  swapMode: "evm" | "stellar",
  address: string | undefined,
  amountIn: string,
  tokenIn: Token | string | EVMToken,
  tokenOut: Token | string | EVMToken,
  selectedEvmChainId: number
): SwapQuoteState & SwapQuoteActions {
  const [amountOut, setAmountOut] = useState<string>("0.0");
  const [isLoadingQuote, setIsLoadingQuote] = useState<boolean>(false);
  const [apiKeyConfigured, setApiKeyConfigured] = useState<boolean>(false);
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const quoteTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const quoteIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const EVM_TOKENS = useMemo(
    () => getTokensForChain(selectedEvmChainId),
    [selectedEvmChainId]
  );

  // Check if API key is configured on mount
  useEffect(() => {
    setApiKeyConfigured(hasApiKey());
  }, []);

  const fetchLiveQuote = useCallback(async () => {
    const trimmedAmount = amountIn?.trim() || "";
    const parsedAmount = parseFloat(trimmedAmount);

    if (
      !address ||
      !trimmedAmount ||
      trimmedAmount === "0" ||
      trimmedAmount === "0." ||
      isNaN(parsedAmount) ||
      parsedAmount <= 0
    ) {
      setAmountOut("0.0");
      setIsLoadingQuote(false);
      return;
    }

    // Define token symbols for both EVM and Stellar modes
    const tokenInSymbol: string =
      typeof tokenIn === "string"
        ? tokenIn
        : isEVMToken(tokenIn)
          ? tokenIn.symbol || "ETH"
          : "ETH";
    const tokenOutSymbol: string =
      typeof tokenOut === "string"
        ? tokenOut
        : isEVMToken(tokenOut)
          ? tokenOut.symbol || "USDC"
          : "USDC";

    // EVM swap quote (CoW Swap)
    if (swapMode === "evm" && publicClient && selectedEvmChainId) {
      try {
        const tokenInObj = EVM_TOKENS[tokenInSymbol];
        if (!tokenInObj) {
          setAmountOut("0.0");
          setIsLoadingQuote(false);
          return;
        }

        const amountInWei = parseUnits(
          trimmedAmount,
          tokenInObj.decimals
        ).toString();

        const quoteRequest: CowSwapQuoteRequest = {
          tokenIn: tokenInSymbol,
          tokenOut: tokenOutSymbol,
          amountIn: amountInWei,
        };

        const quote = await getCowSwapQuote(
          quoteRequest,
          selectedEvmChainId,
          publicClient,
          walletClient
        );

        const tokenOutObj = EVM_TOKENS[tokenOutSymbol];
        if (tokenOutObj) {
          const amountOutFormatted = formatUnits(
            BigInt(quote.amountOut),
            tokenOutObj.decimals
          );
          setAmountOut(amountOutFormatted || "0.0");
        } else {
          // Fallback: format the amount even without token info
          const amountOutStr = quote.amountOut.toString();
          const amountOutFormatted = fromSmallestUnit(amountOutStr, 6);
          setAmountOut(formatSwapAmount(amountOutFormatted, 6));
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error("Quote error:", errorMessage);
        setAmountOut("0.0");
      } finally {
        setIsLoadingQuote(false);
      }
      return;
    }

    // Stellar swap quote
    if (swapMode === "stellar" && !apiKeyConfigured) {
      setAmountOut("0.0");
      setIsLoadingQuote(false);
      return;
    }

    // Cancel previous request if exists
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Store current input values to verify later
    const currentAmountIn = trimmedAmount;
    const currentTokenIn = tokenIn;
    const currentTokenOut = tokenOut;

    // For testing, ensure we have a reasonable amount
    if (!trimmedAmount || parseFloat(trimmedAmount) <= 0) {
      setAmountOut("0.0");
      setIsLoadingQuote(false);
      return;
    }

    setIsLoadingQuote(true);
    try {
      const quoteRequest: QuoteRequest = {
        assetIn: tokenIn as Token | string,
        assetOut: tokenOut as Token | string,
        amount: trimmedAmount,
        tradeType: "EXACT_IN",
        // Start with single protocol for testing
        protocols: ["soroswap"],
        slippageBps: 500, // 5% slippage (more generous)
        maxHops: 1, // Reduce to direct routes only for testing
      };

      const quote = await getQuote(quoteRequest);

      // Check if request was aborted or values changed
      if (abortController.signal.aborted) {
        return;
      }

      // Verify we're still looking at the same values
      const currentAmountTrimmed = amountIn?.trim() || "";
      const valuesMatch =
        currentAmountIn === currentAmountTrimmed &&
        currentTokenIn === tokenIn &&
        currentTokenOut === tokenOut;

      if (!valuesMatch) {
        return;
      }

      // Process the quote result
      if (quote && quote.amountOut) {
        try {
          const amountOutStr = quote.amountOut.toString();
          const amountOutBigInt = BigInt(amountOutStr);

          if (amountOutBigInt > BigInt(0)) {
            const tokenOutObj = EVM_TOKENS[tokenOutSymbol];
            let amountOutFormatted: string;

            if (tokenOutObj) {
              // EVM tokens - use token's decimals
              amountOutFormatted = formatUnits(
                amountOutBigInt,
                tokenOutObj.decimals
              );
            } else {
              // Stellar tokens use 7 decimals
              amountOutFormatted = fromSmallestUnit(amountOutStr, 7);
            }

            const formatted = formatSwapAmount(amountOutFormatted, 6);
            setAmountOut(formatted);
          } else {
            setAmountOut("0.0");
          }
        } catch {
          setAmountOut("0.0");
        }
      } else {
        setAmountOut("0.0");
      }
    } catch (error) {
      // Ignore aborted requests
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }

      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorWithCode = error as { code?: string } | null | undefined;
      const isTimeout =
        errorMessage.includes("timeout") ||
        errorMessage.includes("ECONNABORTED") ||
        errorWithCode?.code === "ECONNABORTED";

      if (isTimeout) {
        setIsLoadingQuote(false);
        return;
      }

      setAmountOut("0.0");
    } finally {
      if (!abortController.signal.aborted) {
        setIsLoadingQuote(false);
      }
    }
  }, [
    address,
    amountIn,
    tokenIn,
    tokenOut,
    apiKeyConfigured,
    swapMode,
    publicClient,
    selectedEvmChainId,
    EVM_TOKENS,
    walletClient,
  ]);

  // Debounced live quote update
  useEffect(() => {
    if (quoteTimeoutRef.current) {
      clearTimeout(quoteTimeoutRef.current);
      quoteTimeoutRef.current = null;
    }

    setIsLoadingQuote(false);

    const trimmedAmount = amountIn?.trim() || "";
    const parsedAmount = parseFloat(trimmedAmount);
    const isZero =
      trimmedAmount === "0" ||
      trimmedAmount === "0." ||
      trimmedAmount === "0.0";
    const isValid =
      trimmedAmount !== "" &&
      !isZero &&
      !isNaN(parsedAmount) &&
      parsedAmount > 0;

    if (!isValid || !address) {
      setAmountOut("0.0");
      setIsLoadingQuote(false);
      return;
    }

    if (swapMode === "stellar" && !apiKeyConfigured) {
      setAmountOut("0.0");
      setIsLoadingQuote(false);
      return;
    }

    setAmountOut("0.0");

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    setIsLoadingQuote(true);

    quoteTimeoutRef.current = setTimeout(() => {
      void fetchLiveQuote();
    }, 50);

    return () => {
      if (quoteTimeoutRef.current) {
        clearTimeout(quoteTimeoutRef.current);
        quoteTimeoutRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      setIsLoadingQuote(false);
    };
  }, [
    amountIn,
    tokenIn,
    tokenOut,
    address,
    apiKeyConfigured,
    fetchLiveQuote,
    swapMode,
  ]);

  // Auto-update quotes every 5 seconds for price fluctuations
  useEffect(() => {
    if (
      address &&
      tokenIn &&
      tokenOut &&
      amountIn &&
      parseFloat(amountIn) > 0
    ) {
      if (quoteIntervalRef.current) {
        clearInterval(quoteIntervalRef.current);
      }
      quoteIntervalRef.current = setInterval(() => {
        void fetchLiveQuote();
      }, 5000);
    } else {
      if (quoteIntervalRef.current) {
        clearInterval(quoteIntervalRef.current);
        quoteIntervalRef.current = null;
      }
    }

    return () => {
      if (quoteIntervalRef.current) {
        clearInterval(quoteIntervalRef.current);
      }
    };
  }, [
    amountIn,
    tokenIn,
    tokenOut,
    address,
    apiKeyConfigured,
    fetchLiveQuote,
    swapMode,
  ]);

  return {
    amountOut,
    isLoadingQuote,
    apiKeyConfigured,
    fetchLiveQuote,
  };
}
