import { nanoid } from "nanoid";
import type {
  AllocationTarget,
  ExecutionStep,
  RebalancePlan,
  VenueCandidate,
} from "../types/automation";
import { blendedNetApyBps } from "./netApy";

interface BuildPlanInput {
  strategyId: string;
  triggerReason: string;
  candidates: VenueCandidate[];
  targets: AllocationTarget[];
  currentAllocs: Record<string, number>; // venueId -> pct
  portfolioUsd: number;
  estimatedSlippageBps: number;
  estimatedFeeUsd: number;
  estimatedGasUsd: number;
}

export function buildRebalancePlan({
  strategyId,
  triggerReason,
  candidates,
  targets,
  currentAllocs: _currentAllocs,
  portfolioUsd,
  estimatedSlippageBps,
  estimatedFeeUsd,
  estimatedGasUsd,
}: BuildPlanInput): RebalancePlan {
  const planId = nanoid();
  const now = Date.now();

  const currentBlendedNetApyBps = blendedNetApyBps(
    candidates,
    Object.fromEntries(candidates.map((c) => [c.id, c.currentAllocationPct]))
  );
  const proposedAllocs = Object.fromEntries(
    targets.map((t) => [t.venueId, t.targetPct])
  );
  const proposedBlendedNetApyBps = blendedNetApyBps(candidates, proposedAllocs);
  const improvementBps = proposedBlendedNetApyBps - currentBlendedNetApyBps;

  // Build ordered steps: withdrawals first, then swaps if needed, then deposits
  const steps: ExecutionStep[] = [];
  let stepIndex = 0;

  const withdrawals = targets.filter((t) => t.deltaUsd < 0);
  const deposits = targets.filter((t) => t.deltaUsd > 0);

  for (const w of withdrawals) {
    const candidate = candidates.find((c) => c.id === w.venueId);
    steps.push({
      id: nanoid(),
      planId,
      index: stepIndex++,
      kind: "withdraw",
      venueId: w.venueId,
      asset: candidate?.asset ?? "USDC",
      amountUsd: Math.abs(w.deltaUsd),
      status: "pending",
      retryCount: 0,
      createdAt: now,
      updatedAt: now,
    });
  }

  for (const d of deposits) {
    const candidate = candidates.find((c) => c.id === d.venueId);
    steps.push({
      id: nanoid(),
      planId,
      index: stepIndex++,
      kind: "deposit",
      venueId: d.venueId,
      asset: candidate?.asset ?? "USDC",
      amountUsd: d.deltaUsd,
      status: "pending",
      retryCount: 0,
      createdAt: now,
      updatedAt: now,
    });
  }

  const annualGainUsd = (improvementBps / 10_000) * portfolioUsd;

  return {
    id: planId,
    strategyId,
    createdAt: now,
    triggerReason,
    currentBlendedNetApyBps,
    proposedBlendedNetApyBps,
    improvementBps,
    estimatedSlippageBps,
    estimatedFeeUsd,
    estimatedGasUsd,
    projectedEarningsDeltaUsd: {
      d30: (annualGainUsd / 365) * 30,
      d90: (annualGainUsd / 365) * 90,
      d365: annualGainUsd,
    },
    targets,
    steps,
    status: "draft",
  };
}
