"use client";

import { useEffect, useMemo } from "react";
import { useWallet } from "@/hooks/useWallet";
import {
  loadPortfolioHistory,
  recordPortfolioSnapshot,
  type PortfolioSnapshot,
} from "../positions/portfolioHistory";
import { useUnifiedPositions } from "./useUnifiedPositions";

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Persists a daily snapshot of the wallet's real net worth (from the
 * unified position engine) to localStorage, and returns the accumulated
 * series with today's live value merged in — so the chart reflects the
 * current total immediately rather than waiting for tomorrow's write. See
 * `positions/portfolioHistory.ts` for why this is real-going-forward data
 * rather than a fabricated backfill.
 */
export function usePortfolioHistory() {
  const { address } = useWallet();
  const { totalValueUsd, isLoading, hasWallet } = useUnifiedPositions();

  // Writing to localStorage is a side effect with no component state to
  // keep in sync, so it never needs to call setState from inside the effect.
  useEffect(() => {
    if (!address || !hasWallet || isLoading) return;
    recordPortfolioSnapshot(address, totalValueUsd);
  }, [address, hasWallet, isLoading, totalValueUsd]);

  const snapshots: PortfolioSnapshot[] = useMemo(() => {
    if (!address) return [];
    const persisted = loadPortfolioHistory(address);
    if (isLoading || !hasWallet) return persisted;

    const today = todayKey();
    const withoutToday = persisted.filter((s) => s.date !== today);
    return [...withoutToday, { date: today, totalValueUsd }].sort((a, b) =>
      a.date.localeCompare(b.date)
    );
  }, [address, hasWallet, isLoading, totalValueUsd]);

  return { snapshots, isLoading };
}
