"use client";

import React from "react";
import type { PoolData } from "@/features/lending/types/lending";

export interface PoolSelectorProps {
  pools: PoolData[];
  selectedPool: PoolData | null;
  onSelect: (pool: PoolData) => void;
  isOpen: boolean;
  onToggle: () => void;
  isLoading: boolean;
}

export function PoolSelector({
  pools,
  selectedPool,
  onSelect,
  isOpen,
  onToggle,
  isLoading,
}: PoolSelectorProps) {
  return (
    <div className="relative z-10">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between bg-white hover:bg-gray-50 border border-[#334EAC]/30 rounded-2xl px-6 py-4 transition-all duration-200 shadow-sm"
      >
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-6">
            <div className="absolute left-0 w-6 h-6 rounded-full bg-[#39bfb7] border-2 border-white flex items-center justify-center text-white text-xs font-bold shadow-md">
              {selectedPool?.token1?.[0] || "?"}
            </div>
            {selectedPool?.token2 && (
              <div className="absolute left-4 w-6 h-6 rounded-full bg-[#68f9f2] border-2 border-white flex items-center justify-center text-[#081F5C] text-xs font-bold shadow-md">
                {selectedPool.token2[0]}
              </div>
            )}
          </div>
          <div className="text-left">
            <h2 className="text-[#081F5C] text-xl font-bold">
              {selectedPool?.name || "Select Pool"}
            </h2>
            <span className="inline-block bg-purple-600 text-white text-xs font-semibold px-2 py-0.5 rounded-md mt-1">
              V2
            </span>
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-[#081F5C] transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 w-full bg-white border border-[#334EAC]/30 rounded-2xl shadow-xl z-50 overflow-hidden">
          {isLoading ? (
            <div className="px-6 py-4 text-center text-[#7096D1]">
              Loading pools...
            </div>
          ) : pools.length === 0 ? (
            <div className="px-6 py-4 text-center text-[#7096D1]">
              No active pools available
            </div>
          ) : (
            pools.map((pool) => (
              <button
                type="button"
                key={pool.id}
                onClick={() => onSelect(pool)}
                className="w-full flex items-center gap-3 px-6 py-4 hover:bg-[#f3f4f6] transition-colors duration-200 border-b border-[#334EAC]/10 last:border-b-0"
              >
                <div className="relative w-10 h-6">
                  <div className="absolute left-0 w-6 h-6 rounded-full bg-[#39bfb7] border-2 border-white flex items-center justify-center text-white text-xs font-bold shadow-md">
                    {pool.token1[0]}
                  </div>
                  {pool.token2 && (
                    <div className="absolute left-4 w-6 h-6 rounded-full bg-[#68f9f2] border-2 border-white flex items-center justify-center text-[#081F5C] text-xs font-bold shadow-md">
                      {pool.token2[0]}
                    </div>
                  )}
                </div>
                <div className="text-left">
                  <p className="text-[#081F5C] font-semibold">{pool.name}</p>
                  <span className="inline-block bg-purple-600 text-white text-xs font-semibold px-2 py-0.5 rounded-md">
                    V2
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
