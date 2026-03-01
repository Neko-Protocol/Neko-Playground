"use client";

import React from "react";

export interface LendingBalanceProps {
  assetCode: string;
  balance: string | null;
  isLoading: boolean;
  onRefresh: () => void;
  bTokenRate?: string;
}

export function LendingBalance({
  assetCode,
  balance,
  isLoading,
  onRefresh,
  bTokenRate,
}: LendingBalanceProps) {
  return (
    <div className="bg-linear-to-br from-[#39bfb7] to-[#68f9f2] rounded-xl p-6 border border-[#334EAC]/30 mb-8 shadow-lg">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-white/80 text-sm">Your bTokens Balance</p>
            {isLoading && (
              <div className="animate-spin rounded-full h-3 w-3 border-2 border-white/30 border-t-white" />
            )}
          </div>
          <p className="text-white text-3xl font-bold">
            {isLoading ? (
              <span className="text-white/60">Loading...</span>
            ) : balance !== null ? (
              <>
                {parseFloat(balance).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 7,
                })}
                <span className="text-xl ml-2">b{assetCode}</span>
              </>
            ) : (
              <span className="text-white/60">--</span>
            )}
          </p>
          {balance !== null && bTokenRate && parseFloat(balance) > 0 && (
            <p className="text-white/70 text-sm mt-2">
              ≈{" "}
              {(parseFloat(balance) * parseFloat(bTokenRate)).toLocaleString(
                undefined,
                {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 7,
                }
              )}{" "}
              {assetCode}
              <span className="text-white/60 text-xs ml-2">
                (Rate: {parseFloat(bTokenRate).toFixed(9)})
              </span>
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          className="bg-white/20 hover:bg-white/30 rounded-full p-3 transition-colors duration-200 disabled:opacity-50"
          title="Refresh balance"
        >
          <svg
            className={`w-8 h-8 text-white ${isLoading ? "animate-spin" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
