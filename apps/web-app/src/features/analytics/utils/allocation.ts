import type {
  ProtocolKind,
  UnifiedPosition,
} from "@/features/dashboard/positions/types";
import type { AllocationEntry } from "../types/analytics";

const PROTOCOL_LABELS: Record<ProtocolKind, string> = {
  wallet: "Wallet",
  pools: "Liquidity Pools",
  lending: "Lending",
  borrowing: "Collateral",
  vault: "Vault",
  backstop: "Backstop",
};

/**
 * Groups priced asset positions from the unified position engine by
 * protocol into the donut's {label, value, pct} shape. Debt is a liability,
 * not an allocation slice, so only `direction: "asset"` positions count —
 * for borrowing that means the collateral, not the debt itself. Positions
 * without a reliable USD price (e.g. Soroswap LP shares) are excluded from
 * the dollar breakdown, the same convention the portfolio total uses.
 */
export function buildAllocationBySource(
  positions: UnifiedPosition[]
): AllocationEntry[] {
  const totals = new Map<string, number>();

  for (const p of positions) {
    if (p.direction !== "asset" || p.valueUsd === null || p.valueUsd <= 0) {
      continue;
    }
    const label = PROTOCOL_LABELS[p.protocol];
    totals.set(label, (totals.get(label) ?? 0) + p.valueUsd);
  }

  const total = Array.from(totals.values()).reduce((sum, v) => sum + v, 0);
  if (total === 0) return [];

  return Array.from(totals.entries())
    .map(([label, value]) => ({
      label,
      value,
      pct: (value / total) * 100,
    }))
    .sort((a, b) => b.value - a.value);
}
