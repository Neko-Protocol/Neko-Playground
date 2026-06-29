import type { VenueCandidate } from "../types/automation";

export function calcNetApyBps(
  candidate: Omit<VenueCandidate, "netApyBps">
): number {
  return (
    candidate.grossApyBps -
    candidate.borrowCostBps -
    candidate.protocolFeeBps -
    candidate.amortizedGasBps
  );
}

export function blendedNetApyBps(
  candidates: VenueCandidate[],
  allocations: Record<string, number> // venueId -> pct (0-100)
): number {
  let total = 0;
  for (const c of candidates) {
    const pct = allocations[c.id] ?? 0;
    total += (pct / 100) * c.netApyBps;
  }
  return total;
}

export function sortByNetApy(candidates: VenueCandidate[]): VenueCandidate[] {
  return [...candidates].sort((a, b) => b.netApyBps - a.netApyBps);
}
