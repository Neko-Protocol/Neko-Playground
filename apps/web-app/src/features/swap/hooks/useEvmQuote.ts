import { useCallback, useMemo } from "react";
import { usePublicClient, useWalletClient } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import type { Token } from "@/lib/helpers/stellar/soroswap";
import type { EVMToken } from "@/lib/types/evmToken";
import {
  getCowSwapQuote,
  type CowSwapQuoteRequest,
} from "@/lib/helpers/evm/cowswap";
import { getTokensForChain } from "@/lib/constants/evmConfig";
import {
  formatSwapAmount,
  fromSmallestUnit,
  getEvmTokenSymbol,
} from "@/lib/helpers/tokenUtils";

/**
 * Fetches a CoW Swap quote for an EVM swap.
 * Returns `null` when a quote cannot be obtained.
 */
export function useEvmQuote(
  amountIn: string,
  tokenIn: Token | string | EVMToken,
  tokenOut: Token | string | EVMToken,
  selectedEvmChainId: number
): { fetchEvmQuote: () => Promise<string | null> } {
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const EVM_TOKENS = useMemo(
    () => getTokensForChain(selectedEvmChainId),
    [selectedEvmChainId]
  );

  const fetchEvmQuote = useCallback(async (): Promise<string | null> => {
    const trimmedAmount = amountIn?.trim() || "";
    const parsedAmount = parseFloat(trimmedAmount);

    if (
      !trimmedAmount ||
      isNaN(parsedAmount) ||
      parsedAmount <= 0 ||
      !publicClient ||
      !selectedEvmChainId
    ) {
      return null;
    }

    const tokenInSymbol = getEvmTokenSymbol(tokenIn, "ETH");
    const tokenOutSymbol = getEvmTokenSymbol(tokenOut, "USDC");

    const tokenInObj = EVM_TOKENS[tokenInSymbol];
    if (!tokenInObj) return null;

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
      return (
        formatUnits(BigInt(quote.amountOut), tokenOutObj.decimals) || "0.0"
      );
    }

    const amountOutStr = quote.amountOut.toString();
    return formatSwapAmount(fromSmallestUnit(amountOutStr, 6), 6);
  }, [
    amountIn,
    tokenIn,
    tokenOut,
    selectedEvmChainId,
    EVM_TOKENS,
    publicClient,
    walletClient,
  ]);

  return { fetchEvmQuote };
}
