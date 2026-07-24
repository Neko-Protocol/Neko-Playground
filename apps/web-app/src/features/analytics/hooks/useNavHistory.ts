"use client";

import { useMemo } from "react";
import { useWallet } from "@/hooks/useWallet";
import { usePortfolioHistory } from "@/features/dashboard/hooks/usePortfolioHistory";
import { filterSnapshotsByWindow } from "@/features/dashboard/positions/portfolioHistory";
import { computeDrawdown } from "../utils/drawdown";
import { WINDOW_DAYS } from "../const/analytics";
import type {
  NavHistoryApiResponse,
  NavPoint,
  TimeWindow,
} from "../types/analytics";

/**
 * Builds the NAV series from the wallet's real, locally-persisted net-worth
 * snapshots (see `usePortfolioHistory`) instead of the seeded-random walk
 * the `/api/analytics/nav-history` route used to fabricate. There is no
 * historical feed to backfill: the series is simply as long as the wallet
 * has been opened since this shipped, so it can legitimately be short or
 * empty for a wallet seen for the first time — that is surfaced as an
 * empty series rather than padded with invented points.
 */
export function useNavHistory(window: TimeWindow) {
  const { address } = useWallet();
  const { snapshots, isLoading } = usePortfolioHistory();

  const data: NavHistoryApiResponse | undefined = useMemo(() => {
    if (!address) return undefined;

    const days =
      window === "all" ? Number.MAX_SAFE_INTEGER : WINDOW_DAYS[window];
    const windowed = filterSnapshotsByWindow(snapshots, days);
    const navValues = windowed.map((s) => s.totalValueUsd);
    const { drawdownSeries } = computeDrawdown(navValues);

    const series: NavPoint[] = windowed.map((s, i) => ({
      date: s.date,
      nav: s.totalValueUsd,
      drawdown: drawdownSeries[i] ?? 0,
    }));

    return { series, window, generatedAt: new Date().toISOString() };
  }, [address, snapshots, window]);

  return { data, isLoading };
}
