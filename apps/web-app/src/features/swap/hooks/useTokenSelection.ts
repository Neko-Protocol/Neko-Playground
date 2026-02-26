import { useState, useMemo, useCallback } from "react";
import { useChainId, useSwitchChain } from "wagmi";
import type { Token } from "@/lib/helpers/stellar/soroswap";
import type { EVMToken } from "@/lib/types/evmToken";
import { getTokensForChain, DEFAULT_CHAIN_ID } from "@/lib/constants/evmConfig";
import { getAvailableTokens } from "@/lib/helpers/stellar/soroswap";
import {
  getTokenId as getTokenIdUtil,
  getTokenIcon,
} from "@/lib/helpers/stellar/swapUtils";

export interface TokenSelectionState {
  tokenSelectorOpen: boolean;
  tokenSelectorType: "from" | "to";
  selectedEvmChainId: number;
}

export interface TokenSelectionActions {
  openTokenSelector: (type: "from" | "to") => void;
  closeTokenSelector: () => void;
  selectToken: (token: Token | string, chainId?: number) => Promise<void>;
  changeChain: (newChainId: number) => Promise<void>;
  getTokenId: (token: Token | string | EVMToken) => string;
  getTokenIconUrl: (token: Token | string | EVMToken) => string | null;
}

export function useTokenSelection(
  swapMode: "evm" | "stellar",
  tokenIn: Token | string | EVMToken,
  tokenOut: Token | string | EVMToken,
  setTokenIn: (token: Token | string | EVMToken) => void,
  setTokenOut: (token: Token | string | EVMToken) => void,
  resetSwap: () => void,
  setTxHash: (hash: string | null) => void
): TokenSelectionState & TokenSelectionActions {
  const [tokenSelectorOpen, setTokenSelectorOpen] = useState<boolean>(false);
  const [tokenSelectorType, setTokenSelectorType] = useState<"from" | "to">(
    "from"
  );
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const [selectedEvmChainId, setSelectedEvmChainId] = useState<number>(
    chainId || DEFAULT_CHAIN_ID
  );

  const EVM_TOKENS = useMemo(
    () => getTokensForChain(selectedEvmChainId),
    [selectedEvmChainId]
  );

  const availableTokens = useMemo(() => getAvailableTokens(), []);

  const openTokenSelector = useCallback((type: "from" | "to") => {
    setTokenSelectorType(type);
    setTokenSelectorOpen(true);
  }, []);

  const closeTokenSelector = useCallback(() => {
    setTokenSelectorOpen(false);
  }, []);

  const getTokenId = useCallback(
    (token: Token | string | EVMToken): string =>
      getTokenIdUtil(token, availableTokens, EVM_TOKENS),
    [EVM_TOKENS, availableTokens]
  );

  const getTokenIconUrl = useCallback(
    (token: Token | string | EVMToken): string | null => getTokenIcon(token),
    []
  );

  const changeChain = useCallback(
    async (newChainId: number) => {
      if (newChainId !== selectedEvmChainId) {
        try {
          // Switch wallet chain first
          if (switchChainAsync) {
            await switchChainAsync({ chainId: newChainId });
          }

          setSelectedEvmChainId(newChainId);
          // Reset tokens to defaults for the new chain
          const newChainTokens = getTokensForChain(newChainId);
          const tokenSymbols = Object.keys(newChainTokens);
          // Set first token as native (ETH/BNB) and second as USDC if available
          const nativeToken =
            tokenSymbols.find((s) => s === "ETH" || s === "BNB") ||
            tokenSymbols[0];
          const stableToken =
            tokenSymbols.find((s) => s === "USDC") || tokenSymbols[1];
          setTokenIn(nativeToken || tokenSymbols[0]);
          setTokenOut(stableToken || tokenSymbols[1] || tokenSymbols[0]);
          resetSwap();
          setTxHash(null);
        } catch (err: unknown) {
          // Check if user rejected the request - this is not an error, just user cancellation
          const errorMessage = err instanceof Error ? err.message : String(err);
          const isUserRejection =
            errorMessage.toLowerCase().includes("user rejected") ||
            errorMessage.toLowerCase().includes("user denied") ||
            errorMessage.includes("4001");

          if (!isUserRejection) {
            console.error("Failed to switch chain:", err);
            throw new Error(
              "Failed to switch network. Please switch manually in your wallet."
            );
          }
        }
      }
    },
    [
      selectedEvmChainId,
      switchChainAsync,
      setTokenIn,
      setTokenOut,
      resetSwap,
      setTxHash,
    ]
  );

  const selectToken = useCallback(
    async (token: Token | string, chainId?: number) => {
      // Update chain if provided, but preserve the token we want to select
      if (chainId && chainId !== selectedEvmChainId) {
        try {
          if (switchChainAsync) {
            await switchChainAsync({ chainId });
          }
          setSelectedEvmChainId(chainId);
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          const isUserRejection =
            errorMessage.toLowerCase().includes("user rejected") ||
            errorMessage.toLowerCase().includes("user denied") ||
            errorMessage.includes("4001");
          if (!isUserRejection) {
            console.error("Failed to switch chain:", err);
          }
        }
      }

      const newTokenId = getTokenId(token);
      const currentTokenInId = getTokenId(tokenIn);
      const currentTokenOutId = getTokenId(tokenOut);

      if (tokenSelectorType === "from") {
        if (newTokenId === currentTokenOutId && newTokenId !== "") {
          setTokenOut(tokenIn);
          setTokenIn(token);
        } else {
          setTokenIn(token);
        }
      } else {
        if (newTokenId === currentTokenInId && newTokenId !== "") {
          setTokenIn(tokenOut);
          setTokenOut(token);
        } else {
          setTokenOut(token);
        }
      }
      resetSwap();
      setTxHash(null);
      closeTokenSelector();
    },
    [
      tokenSelectorType,
      tokenIn,
      tokenOut,
      selectedEvmChainId,
      getTokenId,
      setTokenIn,
      setTokenOut,
      resetSwap,
      setTxHash,
      switchChainAsync,
      closeTokenSelector,
    ]
  );

  return {
    tokenSelectorOpen,
    tokenSelectorType,
    selectedEvmChainId,
    openTokenSelector,
    closeTokenSelector,
    selectToken,
    changeChain,
    getTokenId,
    getTokenIconUrl,
  };
}
