"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import Image from "next/image";
import { X } from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import { useTokenPrice } from "@/hooks/useTokenPrice";
import { getAvailableTokens, type Token } from "@/lib/helpers/stellar/soroswap";
import { getTokenIcon } from "@/lib/helpers/tokenUtils";
import { ModalPortal } from "@/components/ui/ModalPortal";

interface TokenSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectToken: (token: Token | string) => void;
  selectedToken?: Token | string;
}

interface TokenItemProps {
  code: string;
  name: string;
  icon: string | null;
  balance: string;
  usdValue: string;
  isSelected: boolean;
  onClick: () => void;
  showBalance?: boolean;
}

const TokenItem: React.FC<TokenItemProps> = ({
  code,
  name,
  icon,
  balance,
  usdValue,
  isSelected,
  onClick,
  showBalance = true,
}) => {
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
          ? "bg-[#229EDF]/20 cursor-not-allowed border border-[#229EDF]/30"
          : "bg-white/5 hover:bg-white/10 border border-transparent hover:border-white/10"
      }`}
    >
      <div className="relative shrink-0">
        {icon ? (
          <Image
            src={icon}
            alt={code}
            width={40}
            height={40}
            unoptimized
            className="rounded-full shadow-md object-contain p-1"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-[#229EDF]/30 flex items-center justify-center text-white font-bold text-sm shadow-md">
            {code[0]}
          </div>
        )}
      </div>

      <div className={`flex-1 text-left ${showBalance ? "min-w-0" : ""}`}>
        <div
          className={`font-semibold text-white ${showBalance ? "truncate" : ""} text-sm`}
        >
          {name}
        </div>
        <div className="text-xs text-white/50 mt-0.5">{code}</div>
      </div>

      {showBalance && (
        <div className="text-right shrink-0">
          <div className="font-semibold text-white text-sm">${usdValue}</div>
          <div className="text-xs text-white/50 mt-0.5">
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
}) => {
  const { balances } = useWallet();
  const { price: xlmPrice } = useTokenPrice("XLM");
  const availableTokens = useMemo(() => getAvailableTokens(), []);
  const tokenCodes = Object.keys(availableTokens);
  const [searchQuery, setSearchQuery] = useState("");

  const getTokenId = (token: Token | string): string => {
    if (typeof token === "string") {
      for (const [code, info] of Object.entries(availableTokens)) {
        if (info.contract === token) return code;
      }
      return token;
    }
    if (typeof token === "object" && "type" in token) {
      const stellarToken = token as Token;
      if (stellarToken.type === "native") return "XLM";
      if (stellarToken.contract) {
        for (const [code, info] of Object.entries(availableTokens)) {
          if (info.contract === stellarToken.contract) return code;
        }
        return stellarToken.contract;
      }
      return stellarToken.code || "";
    }
    return "";
  };

  const filteredTokens = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return tokenCodes.filter((code) => {
      const token = availableTokens[code];
      return (
        code.toLowerCase().includes(query) ||
        token.name.toLowerCase().includes(query)
      );
    });
  }, [searchQuery, availableTokens, tokenCodes]);

  const getTokenBalance = useCallback(
    (code: string): { balance: string; usdValue: string } => {
      if (code === "XLM" && balances.xlm) {
        const balance = parseFloat(
          balances.xlm.balance?.replace(/,/g, "") || "0"
        );
        const usdValue = balance * xlmPrice;
        return {
          balance: balance.toString(),
          usdValue: usdValue.toFixed(2),
        };
      }

      return { balance: "0", usdValue: "0" };
    },
    [balances, xlmPrice]
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
      return parseFloat(balance) === 0;
    });
  }, [filteredTokens, getTokenBalance]);

  const handleTokenClick = (tokenCode: string) => {
    const token = availableTokens[tokenCode].contract;
    onSelectToken(token);
    setSearchQuery("");
    onClose();
  };

  const handleClose = useCallback(() => {
    setSearchQuery("");
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate__animated animate__fadeIn animate__faster"
        onClick={onClose}
      >
        <div
          className="relative w-full max-w-md bg-[#1C1C1C] border border-white/10 rounded-2xl shadow-2xl max-h-[85vh] flex flex-col overflow-hidden animate__animated animate__fadeInUp animate__faster"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-4 sm:p-5 border-b border-white/10 shrink-0">
            <h2 className="text-lg font-bold text-white">Select a token</h2>
            <button
              onClick={onClose}
              className="text-white/40 hover:text-white transition-colors -mr-1"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-4 border-b border-white/10 shrink-0">
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/40"
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
                className="w-full pl-10 pr-4 py-3 bg-[#2A2A2A] border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:border-[#229EDF]/50 transition-colors"
                autoFocus
              />
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-4 pb-6">
            {userTokens.length > 0 && (
              <div className="mb-6">
                <h3 className="text-xs font-semibold text-white/50 mb-3 px-2 uppercase tracking-wider">
                  Your tokens
                </h3>
                <div className="space-y-1">
                  {userTokens.map((code) => {
                    const isSelected = selectedToken
                      ? getTokenId(selectedToken) === code
                      : false;
                    const { balance, usdValue } = getTokenBalance(code);
                    const tokenInfo = availableTokens[code];
                    const tokenName = tokenInfo?.name || code;
                    const tokenIcon =
                      code === "XLM"
                        ? "/assets/xlm-negro-logo.png"
                        : tokenInfo?.contract
                          ? getTokenIcon(tokenInfo.contract)
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
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {popularTokens.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-white/50 mb-3 px-2 uppercase tracking-wider">
                  Popular tokens
                </h3>
                <div className="flex flex-col gap-3">
                  {popularTokens.map((code) => {
                    const isSelected = selectedToken
                      ? getTokenId(selectedToken) === code
                      : false;
                    const tokenInfo = availableTokens[code];
                    const tokenName = tokenInfo?.name || code;
                    const tokenIcon =
                      code === "XLM"
                        ? "/assets/xlm-negro-logo.png"
                        : tokenInfo?.contract
                          ? getTokenIcon(tokenInfo.contract)
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
                        showBalance={false}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {filteredTokens.length === 0 && (
              <div className="text-center py-12">
                <p className="text-white/60 text-sm">No tokens found</p>
                <p className="text-white/40 text-xs mt-2">
                  Try searching with a different term
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

export default TokenSelectorModal;
