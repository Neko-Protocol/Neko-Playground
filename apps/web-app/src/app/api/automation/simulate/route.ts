import { NextRequest, NextResponse } from "next/server";
import type {
  SimulationResult,
  VenueCandidate,
} from "@/features/automation/types/automation";
import { blendedNetApyBps } from "@/features/automation/utils/netApy";
import { optimizeAllocation } from "@/features/automation/utils/optimizer";
import { shouldRebalance } from "@/features/automation/utils/rebalanceThreshold";
import { estimateSlippageBps } from "@/features/automation/utils/slippage";
import { buildRebalancePlan } from "@/features/automation/utils/planBuilder";
import { PRESET_RULES } from "@/features/automation/const/automation";
import { buildCandidates } from "@/lib/services/candidates.service";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function collectWarnings(candidates: VenueCandidate[]): string[] {
  const warnings: string[] = [];
  for (const c of candidates) {
    if (c.availability === "unavailable") {
      warnings.push(
        `${c.name} excluded from ranking — ${c.unavailableReason ?? "data unavailable"}`
      );
    } else if (c.availability === "partial") {
      warnings.push(
        `${c.name} ranked on partial data — ${c.unavailableReason ?? "liquidity unknown"}`
      );
    }
  }
  return warnings;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const strategyId = searchParams.get("strategyId");
    const walletAddress = searchParams.get("walletAddress");

    if (!walletAddress) {
      return NextResponse.json(
        { error: "walletAddress query parameter is required" },
        { status: 400 }
      );
    }

    const portfolioUsd = 10_000;
    const rule = PRESET_RULES.balanced;
    const candidates = await buildCandidates(walletAddress);
    const warnings = collectWarnings(candidates);

    // Optimizer filters unavailable venues and treats null netApyBps as
    // ineligible; the returned list keeps them for transparency.
    const rankable = candidates.filter(
      (c) => c.availability !== "unavailable" && c.netApyBps !== null
    );

    const currentAllocs = Object.fromEntries(
      candidates.map((c) => [c.id, c.currentAllocationPct])
    );
    const currentBlendedNetApyBps = blendedNetApyBps(candidates, currentAllocs);

    const targets = optimizeAllocation({
      candidates: rankable,
      portfolioUsd,
      constraints: rule.constraints,
    });

    const proposedAllocs = Object.fromEntries(
      targets.map((t) => [t.venueId, t.targetPct])
    );
    const proposedBlendedNetApyBps = blendedNetApyBps(
      candidates,
      proposedAllocs
    );

    const totalMoveUsd = targets.reduce((s, t) => s + Math.abs(t.deltaUsd), 0);
    const estimatedSlippageBps = estimateSlippageBps(
      totalMoveUsd,
      portfolioUsd * 2
    );
    const estimatedFeeUsd = totalMoveUsd * 0.003;
    const estimatedGasUsd = targets.length * 0.05;
    const estimatedExecutionCostUsd = estimatedFeeUsd + estimatedGasUsd;

    const { rebalance, reason } = shouldRebalance({
      currentBlendedNetApyBps,
      proposedBlendedNetApyBps,
      improvementThresholdBps: rule.improvementThresholdBps,
      estimatedExecutionCostUsd,
      portfolioUsd,
      portfolioValueUsd: portfolioUsd,
    });

    const plan = buildRebalancePlan({
      strategyId: strategyId ?? "unknown",
      triggerReason: rebalance ? "Net-APY threshold exceeded" : reason,
      candidates,
      targets,
      currentAllocs,
      portfolioUsd,
      estimatedSlippageBps,
      estimatedFeeUsd,
      estimatedGasUsd,
    });

    const result: SimulationResult = {
      plan,
      candidates,
      dataWarnings: warnings.length > 0 ? warnings : undefined,
    };
    if (!rebalance) result.skippedReason = reason;

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
