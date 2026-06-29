import { NextRequest, NextResponse } from "next/server";
import type { SimulationResult } from "@/features/automation/types/automation";
import {
  calcNetApyBps,
  blendedNetApyBps,
} from "@/features/automation/utils/netApy";
import { optimizeAllocation } from "@/features/automation/utils/optimizer";
import { shouldRebalance } from "@/features/automation/utils/rebalanceThreshold";
import { estimateSlippageBps } from "@/features/automation/utils/slippage";
import { buildRebalancePlan } from "@/features/automation/utils/planBuilder";
import { PRESET_RULES } from "@/features/automation/const/automation";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function buildMockCandidates() {
  const raw = [
    {
      id: "neko-vault",
      kind: "vault" as const,
      name: "Neko Vault",
      asset: "USDC",
      grossApyBps: 850,
      borrowCostBps: 0,
      protocolFeeBps: 30,
      amortizedGasBps: 5,
      availableLiquidityUsd: 500_000,
      currentAllocationPct: 40,
    },
    {
      id: "neko-lending",
      kind: "lending" as const,
      name: "Neko Lending",
      asset: "USDC",
      grossApyBps: 600,
      borrowCostBps: 0,
      protocolFeeBps: 20,
      amortizedGasBps: 5,
      availableLiquidityUsd: 300_000,
      currentAllocationPct: 30,
    },
    {
      id: "neko-xlm-pool",
      kind: "pool" as const,
      name: "XLM/USDC Pool",
      asset: "XLM",
      grossApyBps: 1200,
      borrowCostBps: 0,
      protocolFeeBps: 60,
      amortizedGasBps: 10,
      availableLiquidityUsd: 200_000,
      currentAllocationPct: 20,
    },
    {
      id: "neko-btc-pool",
      kind: "pool" as const,
      name: "BTC/USDC Pool",
      asset: "BTC",
      grossApyBps: 400,
      borrowCostBps: 0,
      protocolFeeBps: 40,
      amortizedGasBps: 10,
      availableLiquidityUsd: 100_000,
      currentAllocationPct: 10,
    },
  ];
  return raw.map((r) => ({ ...r, netApyBps: calcNetApyBps(r) }));
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const _strategyId = searchParams.get("strategyId");

    const portfolioUsd = 10_000;
    const rule = PRESET_RULES.balanced;
    const candidates = buildMockCandidates();

    const currentAllocs = Object.fromEntries(
      candidates.map((c) => [c.id, c.currentAllocationPct])
    );
    const currentBlendedNetApyBps = blendedNetApyBps(candidates, currentAllocs);

    const targets = optimizeAllocation({
      candidates,
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

    if (!rebalance) {
      const result: SimulationResult = {
        plan: buildRebalancePlan({
          strategyId: _strategyId ?? "unknown",
          triggerReason: reason,
          candidates,
          targets,
          currentAllocs,
          portfolioUsd,
          estimatedSlippageBps,
          estimatedFeeUsd,
          estimatedGasUsd,
        }),
        candidates,
        skippedReason: reason,
      };
      return NextResponse.json(result);
    }

    const plan = buildRebalancePlan({
      strategyId: _strategyId ?? "unknown",
      triggerReason: "Net-APY threshold exceeded",
      candidates,
      targets,
      currentAllocs,
      portfolioUsd,
      estimatedSlippageBps,
      estimatedFeeUsd,
      estimatedGasUsd,
    });

    return NextResponse.json({ plan, candidates } satisfies SimulationResult);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
