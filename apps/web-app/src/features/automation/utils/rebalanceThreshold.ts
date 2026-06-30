interface ThresholdInput {
  currentBlendedNetApyBps: number;
  proposedBlendedNetApyBps: number;
  improvementThresholdBps: number;
  estimatedExecutionCostUsd: number;
  portfolioUsd: number;
  portfolioValueUsd: number;
}

export function shouldRebalance({
  currentBlendedNetApyBps,
  proposedBlendedNetApyBps,
  improvementThresholdBps,
  estimatedExecutionCostUsd,
  portfolioUsd,
  portfolioValueUsd: _portfolioValueUsd,
}: ThresholdInput): { rebalance: boolean; reason: string } {
  const improvementBps = proposedBlendedNetApyBps - currentBlendedNetApyBps;

  if (improvementBps < improvementThresholdBps) {
    return {
      rebalance: false,
      reason: `Improvement ${improvementBps}bps below threshold ${improvementThresholdBps}bps`,
    };
  }

  // Annual gain from the improvement
  const annualGainUsd = (improvementBps / 10_000) * portfolioUsd;
  // Break-even: cost paid back in < 30 days
  const breakEvenDays = estimatedExecutionCostUsd / (annualGainUsd / 365);
  if (breakEvenDays > 30) {
    return {
      rebalance: false,
      reason: `Execution cost not recovered within 30 days (${breakEvenDays.toFixed(1)} days)`,
    };
  }

  return {
    rebalance: true,
    reason: `Net-APY gain ${improvementBps}bps exceeds threshold`,
  };
}
