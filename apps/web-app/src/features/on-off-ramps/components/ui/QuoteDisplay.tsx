"use client";

import React from "react";
import type { Quote } from "@/lib/anchors/types";
import { formatCountdown, formatRate } from "../../utils/formatters";

interface QuoteDisplayProps {
  quote: Quote;
  isExpired: boolean;
  secondsLeft: number | null;
  onConfirm: () => void;
  onRefresh: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const QuoteDisplay: React.FC<QuoteDisplayProps> = ({
  quote,
  isExpired,
  secondsLeft,
  onConfirm,
  onRefresh,
  onCancel,
  isLoading,
}) => {
  const fromSymbol = quote.fromCurrency.includes(":")
    ? quote.fromCurrency.split(":")[0]
    : quote.fromCurrency;
  const toSymbol = quote.toCurrency.includes(":")
    ? quote.toCurrency.split(":")[0]
    : quote.toCurrency;

  return (
    <div className="bg-[#1C1C1C] rounded-[20px] p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-white/50 text-sm font-medium">Quote</span>
        {secondsLeft !== null && !isExpired && (
          <span className="text-white/40 text-xs">
            Expires in{" "}
            <span
              className={`font-mono ${secondsLeft <= 30 ? "text-red-400" : "text-white/60"}`}
            >
              {formatCountdown(secondsLeft)}
            </span>
          </span>
        )}
        {isExpired && (
          <span className="text-red-400 text-xs font-medium">Expired</span>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex justify-between">
          <span className="text-white/40 text-sm">You send</span>
          <span className="text-white font-medium">
            {quote.fromAmount} {fromSymbol}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/40 text-sm">You receive</span>
          <span className="text-white font-medium">
            {quote.toAmount} {toSymbol}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/40 text-sm">Rate</span>
          <span className="text-white/60 text-sm">
            {formatRate(quote.exchangeRate, fromSymbol, toSymbol)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/40 text-sm">Fee</span>
          <span className="text-white/60 text-sm">
            {quote.fee} {fromSymbol}
          </span>
        </div>
      </div>

      <div className="h-px bg-white/10" />

      {isExpired ? (
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="w-full py-3 rounded-xl bg-[#229EDF] hover:bg-[#1a8bc7] text-white font-semibold transition-colors disabled:opacity-50"
        >
          {isLoading ? "Refreshing..." : "Get New Quote"}
        </button>
      ) : (
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl bg-[#2A2A2A] hover:bg-[#333] text-white/60 font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 py-3 rounded-xl bg-[#229EDF] hover:bg-[#1a8bc7] text-white font-semibold transition-colors disabled:opacity-50"
          >
            {isLoading ? "Processing..." : "Confirm"}
          </button>
        </div>
      )}
    </div>
  );
};
