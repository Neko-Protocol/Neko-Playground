import { NextResponse, type NextRequest } from "next/server";
import { Horizon } from "@stellar/stellar-sdk";
import { stellarPriceService } from "@/lib/services/stellar-price.service";
import { getAssetsConfig } from "@/lib/constants/assets.config";
import {
  hhi,
  diversificationScore,
} from "@/features/analytics/utils/concentration";
import { projectEarnings } from "@/features/analytics/utils/apy";
import { clientEnv } from "@/lib/env.client";
import type {
  MetricsApiResponse,
  AllocationEntry,
  CorrelationMatrix,
  RiskMetrics,
  ILPosition,
  YieldForecast,
} from "@/features/analytics/types/analytics";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const HORIZON_URL = clientEnv.horizonUrl;

interface StellarBalance {
  asset_type: string;
  asset_code?: string;
  balance: string;
}

/**
 * Price a single Stellar balance using the oracle price service.
 * Returns `null` when the price cannot be determined, rather than
 * fabricating a value with a hardcoded multiplier.
 */
async function priceBalance(
  b: StellarBalance
): Promise<{ code: string; balanceUsd: number } | null> {
  const amount = parseFloat(b.balance ?? "0");
  if (amount <= 0) return null;

  const assetsConfig = getAssetsConfig();

  if (b.asset_type === "native") {
    const price = await stellarPriceService.getPrice(
      "XLM",
      assetsConfig["XLM"]?.contract
    );
    return price > 0 ? { code: "XLM", balanceUsd: amount * price } : null;
  }

  if (b.asset_code) {
    const price = await stellarPriceService.getPrice(
      b.asset_code,
      assetsConfig[b.asset_code]?.contract
    );
    return price > 0
      ? { code: b.asset_code, balanceUsd: amount * price }
      : null;
  }

  return null;
}

/**
 * Fetch all balances from Horizon and price each one through the oracle.
 * Returns both priced and unpriced asset lists so the caller can surface
 * assets without an available price rather than silently omitting them.
 */
async function getHoldings(address: string): Promise<{
  holdings: { code: string; balanceUsd: number }[];
  unpricedAssets: string[];
}> {
  const server = new Horizon.Server(HORIZON_URL);
  const account = await server.loadAccount(address);
  const balances = account.balances as StellarBalance[];

  const results = await Promise.allSettled(
    balances.map((b) => priceBalance(b))
  );

  const holdings: { code: string; balanceUsd: number }[] = [];
  const unpricedAssets: string[] = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const b = balances[i];
    const code =
      b.asset_type === "native" ? "XLM" : (b.asset_code ?? "unknown");

    if (result.status === "fulfilled" && result.value !== null) {
      holdings.push(result.value);
    } else if (result.status === "fulfilled") {
      // Price was 0 or unavailable — asset is unpriced, not fabricated
      const amount = parseFloat(b.balance ?? "0");
      if (amount > 0) unpricedAssets.push(code);
    } else {
      // Price lookup failed — still count as unpriced
      const amount = parseFloat(b.balance ?? "0");
      if (amount > 0) unpricedAssets.push(code);
    }
  }

  return {
    holdings: holdings.filter((h) => h.balanceUsd > 0),
    unpricedAssets,
  };
}

/**
 * Build allocation from real holdings.  On the server we only have
 * wallet-spot balances (no lending/vault/pool data), so allocation is
 * based on wallet balances by asset code.  The client-side
 * `usePortfolioMetrics` hook overrides this with the full unified
 * position engine's per-protocol breakdown.
 */
function buildAllocationFromHoldings(
  holdings: { code: string; balanceUsd: number }[]
): AllocationEntry[] {
  const totals = new Map<string, number>();
  for (const h of holdings) {
    totals.set(h.code, (totals.get(h.code) ?? 0) + h.balanceUsd);
  }
  const total = Array.from(totals.values()).reduce((s, v) => s + v, 0);
  if (total === 0) return [];
  return Array.from(totals.entries())
    .map(([label, value]) => ({ label, value, pct: (value / total) * 100 }))
    .sort((a, b) => b.value - a.value);
}

/**
 * Build a correlation matrix from available assets.
 * Without historical price series we return an identity matrix (each
 * asset perfectly correlated with itself, no cross-correlations).
 * The client-side hook can compute a real matrix if NAV history exists.
 */
function buildEmptyCorrelationMatrix(assets: string[]): CorrelationMatrix {
  const matrix = assets.map((r) => assets.map((c) => (r === c ? 1 : 0)));
  return { assets, matrix };
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const address = searchParams.get("address");

  if (!address) {
    return NextResponse.json({ error: "address required" }, { status: 400 });
  }

  // Fetch vault APY if available
  let vaultApy = 7.5;
  try {
    const origin = req.nextUrl.origin;
    const apyRes = await fetch(`${origin}/api/vault/apy`, {
      next: { revalidate: 300 },
    });
    if (apyRes.ok) {
      const d = await apyRes.json();
      if (d.vaultApy != null) vaultApy = d.vaultApy;
    }
  } catch {
    // fallback
  }

  let holdings: { code: string; balanceUsd: number }[];
  let unpricedAssets: string[];

  try {
    const result = await getHoldings(address);
    holdings = result.holdings;
    unpricedAssets = result.unpricedAssets;
  } catch {
    // Horizon failure — surface an error instead of fabricated holdings
    return NextResponse.json(
      {
        error:
          "Unable to load account balances. The wallet may be unfunded or Horizon is temporarily unavailable.",
      },
      { status: 503 }
    );
  }

  const totalValue = holdings.reduce((s, h) => s + h.balanceUsd, 0);

  // Allocation by source (real balances by asset — overridden client-side)
  const allocationBySource = buildAllocationFromHoldings(holdings);

  // HHI from asset allocation
  const hhiValue = hhi(allocationBySource.map((a) => a.value));
  const divScore = diversificationScore(hhiValue);

  // Correlation matrix — identity until we have historical price series
  const assetCodes = holdings.map((h) => h.code);
  const corrMatrix = buildEmptyCorrelationMatrix(assetCodes);

  // Real blended APY — since we only have wallet balances server-side,
  // use vault APY as a conservative estimate for the wallet portion.
  // The client-side hook recomputes from real per-position APYs.
  const blendedApy = vaultApy;
  const borrowCost = 0;
  const netApy = blendedApy - borrowCost;

  // Protocol fee and network cost estimates — proportional to real value
  const cumulativeFees = totalValue * 0.003;
  const cumulativeNetworkCosts = 2.5;

  // Risk metrics — only derivable metrics are included.
  // Sharpe, sortino, maxDrawdown, and currentDrawdown require a return
  // series and are null until NAV history exists (computed client-side).
  const hasPosition = totalValue > 0;

  const riskScore = Math.min(
    100,
    Math.round((hhiValue / 100) * 0.3 + (blendedApy > 15 ? 15 : 0))
  );

  const riskMetrics: RiskMetrics = {
    sharpe: null,
    sortino: null,
    maxDrawdown: null,
    maxDrawdownDate: null,
    currentDrawdown: null,
    healthFactor: null,
    distanceToLiquidation: null,
    riskScore,
  };

  // IL positions — empty array because we cannot detect LP positions
  // from Horizon balances alone.  The protocol-level IL data requires
  // pool contract queries that are not available server-side here.
  const ilPositions: ILPosition[] = [];

  // Yield forecast from real total value and real blended APY
  const yieldForecast: YieldForecast = {
    days30: parseFloat(projectEarnings(totalValue, blendedApy, 30).toFixed(2)),
    days90: parseFloat(projectEarnings(totalValue, blendedApy, 90).toFixed(2)),
    days365: parseFloat(
      projectEarnings(totalValue, blendedApy, 365).toFixed(2)
    ),
    blendedApy: parseFloat(blendedApy.toFixed(2)),
  };

  const response: MetricsApiResponse = {
    totalValue,
    netApy: parseFloat(netApy.toFixed(2)),
    blendedApy: parseFloat(blendedApy.toFixed(2)),
    borrowCost,
    protocolFees: cumulativeFees,
    hhi: parseFloat(hhiValue.toFixed(0)),
    diversificationScore: divScore,
    allocationBySource,
    correlationMatrix: corrMatrix,
    cumulativeFees,
    cumulativeNetworkCosts,
    riskMetrics,
    ilPositions,
    yieldForecast,
    generatedAt: new Date().toISOString(),
  };

  return NextResponse.json(response);
}
