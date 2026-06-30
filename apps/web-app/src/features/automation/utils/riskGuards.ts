import type { RiskGuards } from "../types/automation";

interface GuardInput {
  guards: RiskGuards;
  currentPortfolioUsd: number;
  initialPortfolioUsd: number;
  currentHealthFactor?: number;
}

export type GuardResult = { pass: boolean; reason: string };

export function checkStopLoss({
  guards,
  currentPortfolioUsd,
  initialPortfolioUsd,
}: GuardInput): GuardResult {
  if (initialPortfolioUsd <= 0) return { pass: true, reason: "ok" };
  const drawdownPct =
    ((initialPortfolioUsd - currentPortfolioUsd) / initialPortfolioUsd) * 100;
  if (drawdownPct >= guards.stopLossPct) {
    return {
      pass: false,
      reason: `Stop-loss triggered: ${drawdownPct.toFixed(2)}% drawdown >= ${guards.stopLossPct}%`,
    };
  }
  return { pass: true, reason: "ok" };
}

export function checkTakeProfit({
  guards,
  currentPortfolioUsd,
  initialPortfolioUsd,
}: GuardInput): GuardResult {
  if (initialPortfolioUsd <= 0) return { pass: true, reason: "ok" };
  const gainPct =
    ((currentPortfolioUsd - initialPortfolioUsd) / initialPortfolioUsd) * 100;
  if (gainPct >= guards.takeProfitPct) {
    return {
      pass: false,
      reason: `Take-profit triggered: ${gainPct.toFixed(2)}% gain >= ${guards.takeProfitPct}%`,
    };
  }
  return { pass: true, reason: "ok" };
}

export function checkHealthFactor({
  guards,
  currentHealthFactor,
}: GuardInput): GuardResult {
  if (currentHealthFactor === undefined) return { pass: true, reason: "ok" };
  if (currentHealthFactor < guards.minHealthFactor) {
    return {
      pass: false,
      reason: `Health factor ${currentHealthFactor.toFixed(2)} below minimum ${guards.minHealthFactor}`,
    };
  }
  return { pass: true, reason: "ok" };
}

export function runAllGuards(input: GuardInput): GuardResult {
  const checks = [
    checkStopLoss(input),
    checkTakeProfit(input),
    checkHealthFactor(input),
  ];
  const failed = checks.find((r) => !r.pass);
  return failed ?? { pass: true, reason: "all guards pass" };
}
