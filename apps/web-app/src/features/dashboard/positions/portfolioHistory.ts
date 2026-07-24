/**
 * Client-side persistence for the portfolio's real net-worth history.
 *
 * There is no historical price/position feed anywhere in the app to
 * backfill from, so this does not try to fabricate one. Instead it records
 * one real snapshot per calendar day, per wallet, starting the day this
 * ships — an honest, growing series rather than a synthetic backfill. This
 * mirrors the localStorage pattern `useLimitOrders` already uses for
 * per-wallet client-side state.
 */

const STORAGE_VERSION = 1;
const MAX_SNAPSHOTS = 400;

export interface PortfolioSnapshot {
  date: string; // YYYY-MM-DD
  totalValueUsd: number;
}

interface PortfolioHistorySchema {
  version: number;
  snapshots: PortfolioSnapshot[];
}

function storageKey(address: string): string {
  return `neko_portfolio_history_v${STORAGE_VERSION}_${address}`;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function loadPortfolioHistory(address: string): PortfolioSnapshot[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey(address));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PortfolioHistorySchema;
    if (parsed.version !== STORAGE_VERSION) return [];
    return parsed.snapshots ?? [];
  } catch {
    return [];
  }
}

/**
 * Records at most one snapshot per calendar day per wallet — repeated calls
 * on the same day overwrite today's value instead of appending duplicates,
 * so refreshing the page throughout the day doesn't inflate the series.
 */
export function recordPortfolioSnapshot(
  address: string,
  totalValueUsd: number
): PortfolioSnapshot[] {
  const existing = loadPortfolioHistory(address);
  const today = todayKey();
  const updated = [
    ...existing.filter((s) => s.date !== today),
    { date: today, totalValueUsd },
  ]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-MAX_SNAPSHOTS);

  if (typeof window !== "undefined") {
    try {
      const schema: PortfolioHistorySchema = {
        version: STORAGE_VERSION,
        snapshots: updated,
      };
      localStorage.setItem(storageKey(address), JSON.stringify(schema));
    } catch {
      // Storage quota exceeded or unavailable — the returned value still
      // reflects this session's snapshot even if it wasn't persisted.
    }
  }

  return updated;
}

/** `days = Infinity` (or anything >= the retention cap) returns everything. */
export function filterSnapshotsByWindow(
  snapshots: PortfolioSnapshot[],
  days: number
): PortfolioSnapshot[] {
  if (days >= MAX_SNAPSHOTS) return snapshots;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffKey = cutoff.toISOString().slice(0, 10);
  return snapshots.filter((s) => s.date >= cutoffKey);
}
