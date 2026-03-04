import { useState, useMemo, useCallback } from "react";
import type { Token } from "@/lib/helpers/stellar/soroswap";
import { getAvailableTokens } from "@/lib/helpers/stellar/soroswap";
import {
  getTokenId as getTokenIdUtil,
  getTokenIcon,
} from "@/lib/helpers/tokenUtils";

export interface TokenSelectionState {
  tokenSelectorOpen: boolean;
  tokenSelectorType: "from" | "to";
}

export interface TokenSelectionActions {
  openTokenSelector: (type: "from" | "to") => void;
  closeTokenSelector: () => void;
  selectToken: (token: Token | string) => Promise<void>;
  getTokenId: (token: Token | string) => string;
  getTokenIconUrl: (token: Token | string) => string | null;
}

export function useTokenSelection(
  tokenIn: Token | string,
  tokenOut: Token | string,
  setTokenIn: (token: Token | string) => void,
  setTokenOut: (token: Token | string) => void,
  resetSwap: () => void,
  setTxHash: (hash: string | null) => void
): TokenSelectionState & TokenSelectionActions {
  const [tokenSelectorOpen, setTokenSelectorOpen] = useState<boolean>(false);
  const [tokenSelectorType, setTokenSelectorType] = useState<"from" | "to">(
    "from"
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
    (token: Token | string): string => getTokenIdUtil(token, availableTokens),
    [availableTokens]
  );

  const getTokenIconUrl = useCallback(
    (token: Token | string): string | null => getTokenIcon(token),
    []
  );

  const selectToken = useCallback(
    async (token: Token | string) => {
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
      getTokenId,
      setTokenIn,
      setTokenOut,
      resetSwap,
      setTxHash,
      closeTokenSelector,
    ]
  );

  return {
    tokenSelectorOpen,
    tokenSelectorType,
    openTokenSelector,
    closeTokenSelector,
    selectToken,
    getTokenId,
    getTokenIconUrl,
  };
}
