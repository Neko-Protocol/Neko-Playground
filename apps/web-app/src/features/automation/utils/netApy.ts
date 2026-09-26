import type { VenueCandidate } from "../types/automation";

export function calcNetApyBps(
  candidate: Omit<VenueCandidate, "netApyBps">
): number | null {
  if (candidate.grossApyBps === null) return null;
  return (
    candidate.grossApyBps -
    candidate.borrowCostBps -
    candidate.protocolFeeBps -
    candidate.amortizedGasBps
  );
}

/**
 * Weighted average of net APY across the supplied allocations.
 * Venues with a null netApyBps contribute 0 to the numerator and are
 * excluded from the denominator, so the blended figure reflects only
 * venues whose APY is actually known.
 */
export function blendedNetApyBps(
  candidates: VenueCandidate[],
  allocations: Record<string, number> // venueId -> pct (0-100)
): number {
  let weighted = 0;
  let weightSum = 0;
  for (const c of candidates) {
    if (c.netApyBps === null) continue;
    const pct = allocations[c.id] ?? 0;
    weighted += (pct / 100) * c.netApyBps;
    weightSum += pct / 100;
  }
  if (weightSum === 0) return 0;
  return weighted / weightSum;
}

export function sortByNetApy(candidates: VenueCandidate[]): VenueCandidate[] {
  return [...candidates].sort((a, b) => {
    const av = a.netApyBps ?? -Infinity;
    const bv = b.netApyBps ?? -Infinity;
    return bv - av;
  });
}
