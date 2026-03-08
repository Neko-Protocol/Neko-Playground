"use client";

import React, { useState } from "react";
import { Coins } from "lucide-react";
import { GetTestTokensModal } from "./GetTestTokensModal";
import { useMissingRwaTokens } from "@/hooks/useMissingRwaTokens";
import { cn } from "@/lib/utils";

export function GetTestTokensBanner({ className }: { className?: string }) {
  const { balances, isFetching, shouldShowBanner } = useMissingRwaTokens();
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (!shouldShowBanner) return null;

  return (
    <>
      <div
        className={cn(
          "relative w-full max-w-full min-w-0 overflow-hidden rounded-2xl bg-[#1C1C1C] border border-[#229EDF]/40",
          "flex min-h-[72px] sm:min-h-[88px] items-center justify-between gap-4 px-4 sm:px-6 py-4",
          className
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
          <Coins className="h-8 w-8 shrink-0 text-[#229EDF] sm:h-9 sm:w-9" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white sm:text-base">
              Get your RWA test tokens
            </p>
            <p className="text-xs text-white/80 sm:text-sm">
              Mint USTRY, TESOURO, CETES, USDY and PYUSD to use Borrow, Lend and
              Pools
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="cursor-pointer shrink-0 rounded-xl border border-[#229EDF]/40 bg-[#229EDF] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1a8bc7]"
        >
          Get Test Tokens
        </button>
      </div>

      <GetTestTokensModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        balances={balances}
        isFetching={isFetching}
      />
    </>
  );
}
