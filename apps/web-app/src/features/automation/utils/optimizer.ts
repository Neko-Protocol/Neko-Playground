import type {
  VenueCandidate,
  AllocationTarget,
  AllocationConstraints,
} from "../types/automation";
import { sortByNetApy } from "./netApy";

interface OptimizerInput {
  candidates: VenueCandidate[];
  portfolioUsd: number;
  constraints: AllocationConstraints;
}

export function optimizeAllocation({
  candidates,
  portfolioUsd,
  constraints,
}: OptimizerInput): AllocationTarget[] {
  const {
    minPositionUsd,
    maxVenueCount,
    reserveBufferPct,
    perVenueCaps,
    allowedAssets,
    deniedAssets,
  } = constraints;

  const deployablePct = 100 - reserveBufferPct;

  // Filter candidates by asset allow/deny lists
  let eligible = candidates.filter((c) => {
    if (deniedAssets.length > 0 && deniedAssets.includes(c.asset)) return false;
    if (allowedAssets.length > 0 && !allowedAssets.includes(c.asset))
      return false;
    return c.netApyBps > 0;
  });

  eligible = sortByNetApy(eligible).slice(0, maxVenueCount);

  if (eligible.length === 0) return [];

  // Equal-weight then apply per-venue caps
  const rawPct = deployablePct / eligible.length;
  const targets: AllocationTarget[] = [];
  let allocated = 0;

  for (const venue of eligible) {
    const cap = perVenueCaps[venue.id] ?? deployablePct;
    const pct = Math.min(rawPct, cap);
    const deltaUsd =
      (pct / 100) * portfolioUsd -
      (venue.currentAllocationPct / 100) * portfolioUsd;

    if (Math.abs(deltaUsd) < minPositionUsd && deltaUsd > 0) continue;

    targets.push({ venueId: venue.id, targetPct: pct, deltaUsd });
    allocated += pct;
  }

  // Redistribute any unallocated pct to top venue up to its cap
  const gap = deployablePct - allocated;
  if (gap > 0 && targets.length > 0) {
    targets[0].targetPct += gap;
    targets[0].deltaUsd += (gap / 100) * portfolioUsd;
  }

  return targets;
}
