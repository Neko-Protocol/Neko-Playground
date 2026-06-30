"use client";

import React, { useState, useCallback } from "react";
import Image from "next/image";
import { ChevronDown, Info } from "lucide-react";
import { AmountInput } from "@/components/AmountInput";
import { getAvailableTokens, type Token } from "@/lib/helpers/stellar/soroswap";
import { getTokenIcon } from "@/lib/helpers/tokenUtils";
import TokenSelectorModal from "./TokenSelectorModal";
import type { LimitOrderSide, LimitOrderExpiry } from "../../types/limitOrder";
import { EXPIRY_LABELS } from "../../types/limitOrder";
import { DEFAULT_SLIPPAGE_BPS } from "../../constants/swapConfig";
import type { AddLimitOrderParams } from "../../hooks/useLimitOrders";

// ─── Sub-components ───────────────────────────────────────────────────────────

interface TokenChipProps {
  symbol: string;
  iconUrl: string | null;
  onClick: () => void;
  disabled?: boolean;
  label: string;
}

const TokenChip: React.FC<TokenChipProps> = ({
  symbol,
  iconUrl,
  onClick,
  disabled,
  label,
}) => (
  <div className="flex flex-col gap-1.5">
    <span className="text-white/50 text-xs font-medium">{label}</span>
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-2 bg-[#2A2A2A] hover:bg-[#333] rounded-xl px-3 py-2.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full"
    >
      {iconUrl ? (
        <Image
          src={iconUrl}
          alt={symbol}
          width={20}
          height={20}
          unoptimized
          className="rounded-full object-contain shrink-0"
        />
      ) : (
        <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[9px] font-bold text-white shrink-0">
          {symbol[0]}
        </div>
      )}
      <span className="text-white font-medium text-sm">{symbol}</span>
      <ChevronDown className="ml-auto h-4 w-4 text-white/40 shrink-0" />
    </button>
  </div>
);

interface SideToggleProps {
  side: LimitOrderSide;
  onChange: (side: LimitOrderSide) => void;
}

const SideToggle: React.FC<SideToggleProps> = ({ side, onChange }) => (
  <div className="flex rounded-lg overflow-hidden border border-white/10 w-fit">
    {(["buy", "sell"] as LimitOrderSide[]).map((s) => (
      <button
        key={s}
        type="button"
        onClick={() => onChange(s)}
        className={`px-5 py-1.5 text-sm font-semibold capitalize transition-colors ${
          side === s
            ? s === "buy"
              ? "bg-emerald-500/80 text-white"
              : "bg-red-500/80 text-white"
            : "text-white/40 hover:text-white/70 bg-transparent"
        }`}
      >
        {s}
      </button>
    ))}
  </div>
);

// ─── Main Form ────────────────────────────────────────────────────────────────

interface LimitOrderFormProps {
  walletAddress: string;
  onSubmit: (params: Omit<AddLimitOrderParams, "walletAddress">) => void;
  disabled?: boolean;
}

export const LimitOrderForm: React.FC<LimitOrderFormProps> = ({
  walletAddress,
  onSubmit,
  disabled,
}) => {
  const availableTokens = getAvailableTokens();
  const tokenCodes = Object.keys(availableTokens);

  const defaultTokenInCode = tokenCodes[0] ?? "XLM";
  const defaultTokenOutCode = tokenCodes[1] ?? "USDC";

  const [tokenInCode, setTokenInCode] = useState<string>(defaultTokenInCode);
  const [tokenOutCode, setTokenOutCode] = useState<string>(defaultTokenOutCode);
  const [amountIn, setAmountIn] = useState("");
  const [limitPrice, setLimitPrice] = useState("");
  const [side, setSide] = useState<LimitOrderSide>("buy");
  const [expiry, setExpiry] = useState<LimitOrderExpiry>("24h");
  const [slippageBps, setSlippageBps] = useState(DEFAULT_SLIPPAGE_BPS);
  const [showSlippage, setShowSlippage] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectorFor, setSelectorFor] = useState<"in" | "out">("in");

  const [errors, setErrors] = useState<{
    amountIn?: string;
    limitPrice?: string;
  }>({});

  // ── Helpers ────────────────────────────────────────────────────────────────

  const getTokenSymbol = (code: string) => code;

  const getTokenIconUrl = (code: string): string | null => {
    if (code === "XLM") return "/assets/xlm-negro-logo.png";
    const info = availableTokens[code];
    return info?.contract ? getTokenIcon(info.contract) : null;
  };

  const getTokenContract = (code: string): string =>
    availableTokens[code]?.contract ?? code;

  const openSelector = (type: "in" | "out") => {
    setSelectorFor(type);
    setSelectorOpen(true);
  };

  const handleTokenSelect = useCallback(
    (token: Token | string) => {
      const contract =
        typeof token === "string" ? token : (token.contract ?? "");
      const code =
        Object.entries(availableTokens).find(
          ([, info]) => info.contract === contract
        )?.[0] ?? contract;

      if (selectorFor === "in") {
        if (code === tokenOutCode) setTokenOutCode(tokenInCode);
        setTokenInCode(code);
      } else {
        if (code === tokenInCode) setTokenInCode(tokenOutCode);
        setTokenOutCode(code);
      }
      setSelectorOpen(false);
    },
    [availableTokens, selectorFor, tokenInCode, tokenOutCode]
  );

  // ── Validation & Submit ───────────────────────────────────────────────────

  const validate = (): boolean => {
    const newErrors: typeof errors = {};
    if (!amountIn || parseFloat(amountIn) <= 0)
      newErrors.amountIn = "Enter a valid amount";
    if (!limitPrice || parseFloat(limitPrice) <= 0)
      newErrors.limitPrice = "Enter a valid limit price";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || disabled) return;

    onSubmit({
      tokenIn: getTokenContract(tokenInCode),
      tokenOut: getTokenContract(tokenOutCode),
      tokenInSymbol: getTokenSymbol(tokenInCode),
      tokenOutSymbol: getTokenSymbol(tokenOutCode),
      amountIn,
      limitPrice,
      side,
      expiry,
      slippageBps,
    });

    // Reset form
    setAmountIn("");
    setLimitPrice("");
    setErrors({});
  };

  const slippagePct = (slippageBps / 100).toFixed(2);

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-[#1C1C1C] rounded-[20px] p-5 flex flex-col gap-5"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold text-base">
          Create Limit Order
        </h3>
        <SideToggle side={side} onChange={setSide} />
      </div>

      {/* Token selectors */}
      <div className="grid grid-cols-2 gap-3">
        <TokenChip
          label="Sell token"
          symbol={getTokenSymbol(tokenInCode)}
          iconUrl={getTokenIconUrl(tokenInCode)}
          onClick={() => openSelector("in")}
          disabled={disabled}
        />
        <TokenChip
          label="Buy token"
          symbol={getTokenSymbol(tokenOutCode)}
          iconUrl={getTokenIconUrl(tokenOutCode)}
          onClick={() => openSelector("out")}
          disabled={disabled}
        />
      </div>

      {/* Sell amount */}
      <div className="flex flex-col gap-1.5">
        <label className="text-white/50 text-xs font-medium">
          Sell amount ({getTokenSymbol(tokenInCode)})
        </label>
        <div className="bg-[#2A2A2A] rounded-xl px-4 h-12 flex items-center">
          <AmountInput
            value={amountIn}
            onChange={setAmountIn}
            disabled={disabled}
            className="bg-transparent text-white text-xl font-bold w-full outline-none placeholder:text-white/30 disabled:opacity-50"
          />
        </div>
        {errors.amountIn && (
          <p className="text-red-400 text-xs">{errors.amountIn}</p>
        )}
      </div>

      {/* Limit price */}
      <div className="flex flex-col gap-1.5">
        <label className="text-white/50 text-xs font-medium">
          Limit price ({getTokenSymbol(tokenOutCode)} per{" "}
          {getTokenSymbol(tokenInCode)})
        </label>
        <div className="bg-[#2A2A2A] rounded-xl px-4 h-12 flex items-center">
          <AmountInput
            value={limitPrice}
            onChange={setLimitPrice}
            disabled={disabled}
            className="bg-transparent text-white text-xl font-bold w-full outline-none placeholder:text-white/30 disabled:opacity-50"
          />
        </div>
        {errors.limitPrice && (
          <p className="text-red-400 text-xs">{errors.limitPrice}</p>
        )}
      </div>

      {/* Expiry */}
      <div className="flex flex-col gap-1.5">
        <span className="text-white/50 text-xs font-medium">Expires in</span>
        <div className="flex gap-2 flex-wrap">
          {(Object.keys(EXPIRY_LABELS) as LimitOrderExpiry[]).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setExpiry(opt)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors border ${
                expiry === opt
                  ? "bg-[#229EDF]/20 border-[#229EDF]/60 text-[#229EDF]"
                  : "border-white/10 text-white/50 hover:text-white/70 hover:border-white/20"
              }`}
            >
              {opt === "gtc" ? "GTC" : opt}
            </button>
          ))}
        </div>
      </div>

      {/* Slippage (collapsible) */}
      <div>
        <button
          type="button"
          onClick={() => setShowSlippage((v) => !v)}
          className="flex items-center gap-1.5 text-white/40 hover:text-white/60 text-xs transition-colors"
        >
          <Info className="h-3.5 w-3.5" />
          Slippage tolerance: {slippagePct}%
        </button>
        {showSlippage && (
          <div className="mt-2 flex gap-2 items-center">
            {[100, 300, 500, 1000].map((bps) => (
              <button
                key={bps}
                type="button"
                onClick={() => setSlippageBps(bps)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors border ${
                  slippageBps === bps
                    ? "bg-[#229EDF]/20 border-[#229EDF]/60 text-[#229EDF]"
                    : "border-white/10 text-white/50 hover:text-white/70"
                }`}
              >
                {(bps / 100).toFixed(1)}%
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={disabled || !walletAddress}
        className="w-full py-3.5 bg-[#229EDF] hover:bg-[#1a8bc7] text-white font-bold rounded-2xl transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#229EDF]/20"
      >
        Place Limit Order
      </button>

      <TokenSelectorModal
        isOpen={selectorOpen}
        onClose={() => setSelectorOpen(false)}
        onSelectToken={handleTokenSelect}
        selectedToken={
          selectorFor === "in"
            ? getTokenContract(tokenInCode)
            : getTokenContract(tokenOutCode)
        }
      />
    </form>
  );
};
