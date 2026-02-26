import { useState, useMemo, useCallback } from "react";
import { useChainId, useSwitchChain } from "wagmi";
import type { Token } from "@/lib/helpers/soroswap";
import { isEVMToken, type EVMToken } from "@/lib/types/evmToken";
import { getTokensForChain, DEFAULT_CHAIN_ID } from "@/lib/constants/evmConfig";
import { getAvailableTokens, TOKENS } from "@/lib/helpers/soroswap";

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
    (token: Token | string | EVMToken): string => {
      if (isEVMToken(token)) {
        return token.symbol || "";
      }

      if (typeof token === "string") {
        // Check if it's an EVM token symbol
        if (EVM_TOKENS[token]) {
          return token;
        }
        // Token is already a string (contract address)
        // Find which token code matches this contract address
        for (const [code, info] of Object.entries(availableTokens)) {
          if (info.contract === token) {
            return code;
          }
        }
        return token;
      }

      // Token is an object (legacy format)
      if (token.type === "native") return "XLM";
      if (token.contract) {
        // Find matching token code
        for (const [code, info] of Object.entries(availableTokens)) {
          if (info.contract === token.contract) {
            return code;
          }
        }
        return token.contract;
      }
      if (token.code) return token.code;
      return "";
    },
    [EVM_TOKENS, availableTokens]
  );

  const getTokenIconUrl = useCallback(
    (token: Token | string | EVMToken): string | null => {
      // Import getTokenIcon dynamically to avoid circular dependencies
      const { getTokenIcon } = require("@/lib/helpers/swapUtils");
      return getTokenIcon(token as Token | string | EVMToken);
    },
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
      console.log("selectToken called:", {
        token,
        chainId,
        tokenSelectorType,
        currentTokenIn: tokenIn,
        currentTokenOut: tokenOut,
        selectedEvmChainId,
      });

      // Update chain if provided, but preserve the token we want to select
      if (chainId && chainId !== selectedEvmChainId) {
        console.log("Chain change needed");
        try {
          // Switch wallet chain first
          if (switchChainAsync) {
            await switchChainAsync({ chainId });
          }
          setSelectedEvmChainId(chainId);
          // Don't reset tokens here - we'll set them below
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

      console.log("Token IDs:", {
        newTokenId,
        currentTokenInId,
        currentTokenOutId,
      });

      // Always update the token - force update by creating a new reference if needed
      if (tokenSelectorType === "from") {
        // If trying to select the same token as tokenOut, swap them
        if (newTokenId === currentTokenOutId && newTokenId !== "") {
          console.log("Swapping tokens (from matches out)");
          setTokenOut(tokenIn);
          setTokenIn(token);
        } else {
          console.log("Setting tokenIn to:", token);
          // Force update by ensuring it's a new value
          setTokenIn(token);
        }
      } else {
        // If trying to select the same token as tokenIn, swap them
        if (newTokenId === currentTokenInId && newTokenId !== "") {
          console.log("Swapping tokens (to matches in)");
          setTokenIn(tokenOut);
          setTokenOut(token);
        } else {
          console.log("Setting tokenOut to:", token);
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
