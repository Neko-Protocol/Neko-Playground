"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useWallet } from "@/hooks/useWallet";
import { getAvailableTokens, type Token } from "@/lib/helpers/stellar/soroswap";
import { getTokenIcon } from "@/lib/helpers/stellar/swapUtils";
import {
  getTokensForChain,
  SUPPORTED_CHAINS,
  DEFAULT_CHAIN_ID,
  type ChainConfig,
} from "@/lib/constants/evmConfig";
import { isEVMToken, type EVMToken } from "@/lib/types/evmToken";

interface TokenSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectToken: (token: Token | string, chainId?: number) => void;
  selectedToken?: Token | string;
  swapMode?: "evm" | "stellar";
  selectedChainId?: number;
  onChainChange?: (chainId: number) => void;
}

interface TokenItemProps {
  code: string;
  name: string;
  icon: string | null;
  balance: string;
  usdValue: string;
  isSelected: boolean;
  onClick: () => void;
  swapMode: "evm" | "stellar";
  showBalance?: boolean;
  chainIcon?: string;
}

interface ChainSelectorProps {
  chains: ChainConfig[];
  selectedChainId: number;
  onChainSelect: (chainId: number) => void;
}

const ChainSelector: React.FC<ChainSelectorProps> = ({
  chains,
  selectedChainId,
  onChainSelect,
}) => {
  return (
    <div className="flex gap-2 p-2 bg-gray-200 rounded-xl">
      {chains.map((chain) => (
        <button
          key={chain.id}
          onClick={() => onChainSelect(chain.id)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
            selectedChainId === chain.id
              ? "bg-[#334EAC] text-white shadow-md"
              : "bg-white text-gray-700 hover:bg-gray-100"
          }`}
        >
          <img
            src={chain.icon}
            alt={chain.name}
            className="w-5 h-5 rounded-full object-contain"
          />
          <span className="text-sm font-medium">{chain.name}</span>
        </button>
      ))}
    </div>
  );
};

const TokenItem: React.FC<TokenItemProps> = ({
  code,
  name,
  icon,
  balance,
  usdValue,
  isSelected,
  onClick,
  swapMode,
  showBalance = true,
  chainIcon,
}) => {
  const displayIcon = icon;

  const formatBalance = (balance: string): string => {
    const num = parseFloat(balance);
    if (num === 0) return "0";
    if (num < 0.000001) return num.toExponential(2);
    if (num < 0.001) return num.toFixed(6);
    if (num < 1) return num.toFixed(4);
    if (num < 1000) return num.toFixed(2);
    return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  return (
    <button
      onClick={onClick}
      disabled={isSelected}
      className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${
        isSelected
          ? "bg-[#334EAC]/20 cursor-not-allowed border border-[#334EAC]/30"
          : "bg-white hover:bg-gray-50 border border-transparent hover:border-gray-300"
      }`}
    >
      <div className="relative shrink-0">
        {displayIcon ? (
          <img
            src={displayIcon}
            alt={code}
            className="w-10 h-10 rounded-full shadow-md object-contain p-1"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-linear-to-br from-[#334EAC] to-[#081F5C] flex items-center justify-center text-white font-bold text-sm shadow-md">
            {code[0]}
          </div>
        )}
        {chainIcon && (
          <img
            src={chainIcon}
            alt="chain"
            className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white shadow-sm object-contain bg-white"
          />
        )}
      </div>

      <div className={`flex-1 text-left ${showBalance ? "min-w-0" : ""}`}>
        <div
          className={`font-semibold text-gray-900 ${showBalance ? "truncate" : ""} text-sm`}
        >
          {name}
        </div>
        <div className="text-xs text-gray-500 mt-0.5">{code}</div>
      </div>

      {showBalance && (
        <div className="text-right shrink-0">
          <div className="font-semibold text-gray-900 text-sm">${usdValue}</div>
          <div className="text-xs text-gray-500 mt-0.5">
            {formatBalance(balance)}
          </div>
        </div>
      )}
    </button>
  );
};

const TokenSelectorModal: React.FC<TokenSelectorModalProps> = ({
  isOpen,
  onClose,
  onSelectToken,
  selectedToken,
  swapMode = "stellar",
  selectedChainId = DEFAULT_CHAIN_ID,
  onChainChange,
}) => {
  const { balances } = useWallet();
  const [localChainId, setLocalChainId] = useState(selectedChainId);
  const availableTokens = swapMode === "stellar" ? getAvailableTokens() : {};

  // Get tokens for the selected chain
  const evmTokens = useMemo(
    () => (swapMode === "evm" ? getTokensForChain(localChainId) : {}),
    [swapMode, localChainId]
  );

  const tokenCodes =
    swapMode === "stellar"
      ? Object.keys(availableTokens)
      : Object.keys(evmTokens);
  const [searchQuery, setSearchQuery] = useState("");

  // Sync local chain with prop
  useEffect(() => {
    setLocalChainId(selectedChainId);
  }, [selectedChainId]);

  const handleChainChange = (chainId: number) => {
    setLocalChainId(chainId);
    onChainChange?.(chainId);
  };

  // Get chain icon for current chain
  const currentChainIcon = useMemo(() => {
    const chain = SUPPORTED_CHAINS.find((c) => c.id === localChainId);
    return chain?.icon || null;
  }, [localChainId]);

  const getTokenId = (token: Token | string | EVMToken): string => {
    if (swapMode === "evm") {
      if (isEVMToken(token)) {
        return token.symbol || "";
      }
      if (typeof token === "string") {
        if (evmTokens[token]) {
          return token;
        }
        const evmToken = Object.values(evmTokens).find(
          (t) => t.address.toLowerCase() === token.toLowerCase()
        );
        return evmToken?.symbol || token;
      }
      return "";
    } else {
      if (typeof token === "string") {
        for (const [code, info] of Object.entries(availableTokens)) {
          if (info.contract === token) {
            return code;
          }
        }
        return token;
      }
      if (typeof token === "object" && "type" in token) {
        const stellarToken = token as Token;
        if (stellarToken.type === "native") return "XLM";
        if (stellarToken.contract) {
          for (const [code, info] of Object.entries(availableTokens)) {
            if (info.contract === stellarToken.contract) {
              return code;
            }
          }
          return stellarToken.contract;
        }
        return stellarToken.code || "";
      }
      return "";
    }
  };

  const filteredTokens = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return tokenCodes.filter((code) => {
      if (swapMode === "evm") {
        const token = evmTokens[code];
        return (
          code.toLowerCase().includes(query) ||
          (token?.name?.toLowerCase().includes(query) ?? false) ||
          (token?.symbol?.toLowerCase().includes(query) ?? false)
        );
      } else {
        const token = availableTokens[code];
        return (
          code.toLowerCase().includes(query) ||
          token.name.toLowerCase().includes(query)
        );
      }
    });
  }, [searchQuery, availableTokens, tokenCodes, swapMode, evmTokens]);

  const getTokenBalance = useCallback(
    (code: string): { balance: string; usdValue: string } => {
      if (swapMode === "evm") {
        return { balance: "0", usdValue: "0" };
      }

      if (code === "XLM" && balances.xlm) {
        const balance = parseFloat(
          balances.xlm.balance?.replace(/,/g, "") || "0"
        );
        const usdValue = balance * 0.1;
        return {
          balance: balance.toString(),
          usdValue: usdValue.toFixed(2),
        };
      }

      return { balance: "0", usdValue: "0" };
    },
    [balances, swapMode]
  );

  const userTokens = useMemo(() => {
    return filteredTokens.filter((code) => {
      const { balance } = getTokenBalance(code);
      return parseFloat(balance) > 0;
    });
  }, [filteredTokens, getTokenBalance]);

  const popularTokens = useMemo(() => {
    return filteredTokens.filter((code) => {
      const { balance } = getTokenBalance(code);
      const isUserToken = parseFloat(balance) > 0;
      return !isUserToken;
    });
  }, [filteredTokens, getTokenBalance]);

  const handleTokenClick = (tokenCode: string) => {
    console.log("handleTokenClick called:", {
      tokenCode,
      swapMode,
      localChainId,
    });
    if (swapMode === "evm") {
      console.log("Calling onSelectToken with EVM token:", tokenCode);
      onSelectToken(tokenCode, localChainId);
    } else {
      const token = availableTokens[tokenCode].contract;
      console.log("Calling onSelectToken with Stellar token:", token);
      onSelectToken(token);
    }
    setSearchQuery("");
    onClose();
  };

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-full max-w-md bg-gray-100 border border-gray-300 rounded-2xl shadow-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-300">
          <h2 className="text-xl font-bold text-gray-900">Select a token</h2>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-900 transition-colors p-1.5 rounded-lg hover:bg-gray-200"
            aria-label="Close"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 5L5 15M5 5l10 10" />
            </svg>
          </button>
        </div>

        {/* Chain Selector - Only show for EVM mode */}
        {swapMode === "evm" && (
          <div className="px-4 pt-4">
            <ChainSelector
              chains={SUPPORTED_CHAINS}
              selectedChainId={localChainId}
              onChainSelect={handleChainChange}
            />
          </div>
        )}

        <div className="p-4 border-b border-gray-300">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="8" cy="8" r="5.5" />
              <path d="M13.5 13.5l-3-3" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tokens"
              className="w-full pl-10 pr-4 py-3 bg-white border-2 border-gray-300 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#334EAC] transition-colors"
              autoFocus
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {userTokens.length > 0 && (
            <div className="mb-6">
              <h3 className="text-xs font-semibold text-gray-500 mb-3 px-2 uppercase tracking-wider">
                Your tokens
              </h3>
              <div className="space-y-1">
                {userTokens.map((code) => {
                  const isSelected = selectedToken
                    ? getTokenId(selectedToken) === code
                    : false;
                  const { balance, usdValue } = getTokenBalance(code);

                  const tokenInfo =
                    swapMode === "evm"
                      ? evmTokens[code]
                      : availableTokens[code];
                  const tokenName =
                    swapMode === "evm"
                      ? (tokenInfo as EVMToken)?.name || code
                      : (tokenInfo as { name: string })?.name || code;
                  const tokenIcon =
                    swapMode === "evm"
                      ? getTokenIcon(tokenInfo as EVMToken | string)
                      : (tokenInfo as { contract?: string })?.contract
                        ? getTokenIcon(
                            (tokenInfo as { contract: string }).contract
                          )
                        : null;

                  return (
                    <TokenItem
                      key={code}
                      code={code}
                      name={tokenName}
                      icon={tokenIcon}
                      balance={balance}
                      usdValue={usdValue}
                      isSelected={isSelected}
                      onClick={() => handleTokenClick(code)}
                      swapMode={swapMode}
                      chainIcon={
                        swapMode === "evm"
                          ? currentChainIcon || undefined
                          : undefined
                      }
                    />
                  );
                })}
              </div>
            </div>
          )}

          {popularTokens.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 mb-3 px-2 uppercase tracking-wider">
                Popular tokens
              </h3>
              <div className="flex flex-col gap-3">
                {popularTokens.map((code) => {
                  const isSelected = selectedToken
                    ? getTokenId(selectedToken) === code
                    : false;

                  const tokenInfo =
                    swapMode === "evm"
                      ? evmTokens[code]
                      : availableTokens[code];
                  const tokenName =
                    swapMode === "evm"
                      ? (tokenInfo as EVMToken)?.name || code
                      : (tokenInfo as { name: string })?.name || code;
                  const tokenIcon =
                    swapMode === "evm"
                      ? getTokenIcon(tokenInfo as EVMToken | string)
                      : (tokenInfo as { contract?: string })?.contract
                        ? getTokenIcon(
                            (tokenInfo as { contract: string }).contract
                          )
                        : null;

                  return (
                    <TokenItem
                      key={code}
                      code={code}
                      name={tokenName}
                      icon={tokenIcon}
                      balance="0"
                      usdValue="0"
                      isSelected={isSelected}
                      onClick={() => handleTokenClick(code)}
                      swapMode={swapMode}
                      showBalance={false}
                      chainIcon={
                        swapMode === "evm"
                          ? currentChainIcon || undefined
                          : undefined
                      }
                    />
                  );
                })}
              </div>
            </div>
          )}

          {filteredTokens.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 text-sm">No tokens found</p>
              <p className="text-gray-400 text-xs mt-2">
                Try searching with a different term
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TokenSelectorModal;
