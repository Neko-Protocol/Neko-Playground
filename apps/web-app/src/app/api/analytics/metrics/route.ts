import { NextResponse, type NextRequest } from "next/server";
import { Horizon } from "@stellar/stellar-sdk";
import { hhi, diversificationScore } from "@/features/analytics/utils/concentration";
import { projectEarnings } from "@/features/analytics/utils/apy";
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

const HORIZON_URL =
  process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL ??
  "https://horizon-testnet.stellar.org";

interface StellarBalance {
  asset_type: string;
  asset_code?: string;
  balance: string;
}

async function getHoldings(
  address: string
): Promise<{ code: string; balanceUsd: number }[]> {
  try {
    const server = new Horizon.Server(HORIZON_URL);
    const account = await server.loadAccount(address);
    const balances = account.balances as StellarBalance[];

    return balances
      .map((b) => {
        const amount = parseFloat(b.balance ?? "0");
        if (b.asset_type === "native") {
          return { code: "XLM", balanceUsd: amount * 0.1 };
        }
        if (
          b.asset_code === "USDC" ||
          b.asset_code === "USDT" ||
          b.asset_code === "EURC"
        ) {
          return { code: b.asset_code, balanceUsd: amount };
        }
        if (b.asset_code) {
          return { code: b.asset_code, balanceUsd: amount * 0.5 };
        }
        return null;
      })
      .filter(
        (h): h is { code: string; balanceUsd: number } =>
          h !== null && h.balanceUsd > 0
      );
  } catch {
    return [
      { code: "XLM", balanceUsd: 50 },
      { code: "USDC", balanceUsd: 100 },
    ];
  }
}

function buildAllocationBySource(totalUsd: number): AllocationEntry[] {
  const weights = [
    { label: "Vault", pct: 35 },
    { label: "Lending", pct: 30 },
    { label: "Pools", pct: 25 },
    { label: "RWA", pct: 10 },
  ];
  return weights.map((w) => ({
    label: w.label,
    value: (totalUsd * w.pct) / 100,
    pct: w.pct,
  }));
}

function buildCorrelationMatrix(assets: string[]): CorrelationMatrix {
  // Synthetic but realistic correlation for DeFi assets
  const baseCorrelations: Record<string, Record<string, number>> = {
    XLM: { XLM: 1, USDC: -0.05, USDT: -0.03, EURC: 0.02, CETES: 0.08 },
    USDC: { XLM: -0.05, USDC: 1, USDT: 0.95, EURC: 0.88, CETES: 0.12 },
    USDT: { XLM: -0.03, USDC: 0.95, USDT: 1, EURC: 0.87, CETES: 0.1 },
    EURC: { XLM: 0.02, USDC: 0.88, USDT: 0.87, EURC: 1, CETES: 0.14 },
    CETES: { XLM: 0.08, USDC: 0.12, USDT: 0.1, EURC: 0.14, CETES: 1 },
  };

  const matrix = assets.map((r) =>
    assets.map((c) => {
      if (r === c) return 1;
      return baseCorrelations[r]?.[c] ?? baseCorrelations[c]?.[r] ?? 0.15;
    })
  );

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

  const holdings = await getHoldings(address);
  const totalValue = holdings.reduce((s, h) => s + h.balanceUsd, 0);

  // Allocation by source (estimated)
  const allocationBySource = buildAllocationBySource(totalValue);

  // HHI from asset allocation
  const hhiValue = hhi(allocationBySource.map((a) => a.value));
  const divScore = diversificationScore(hhiValue);

  // Correlation matrix
  const assetCodes = holdings.map((h) => h.code);
  const corrMatrix = buildCorrelationMatrix(assetCodes);

  // Synthetic risk metrics
  const blendedApy =
    vaultApy * 0.35 + 8.2 * 0.3 + 12.4 * 0.25 + 4.8 * 0.1;
  const borrowCost = totalValue > 200 ? 5.5 : 0;
  const netApy = blendedApy - borrowCost;

  // Protocol fee and network cost estimates
  const cumulativeFees = totalValue * 0.003;
  const cumulativeNetworkCosts = 2.5;

  // Risk metrics
  const hasPosition = totalValue > 0;
  const healthFactor = hasPosition && borrowCost > 0 ? 1.85 : null;
  const distanceToLiquidation =
    healthFactor != null ? ((healthFactor - 1.0) / healthFactor) * 100 : null;

  const maxDd = 4.2;
  const riskScore = Math.min(
    100,
    Math.round(
      (borrowCost > 0 ? 20 : 0) +
        (hhiValue / 100) * 0.3 +
        maxDd * 2 +
        (blendedApy > 15 ? 15 : 0)
    )
  );

  const riskMetrics: RiskMetrics = {
    sharpe: 1.42,
    sortino: 1.87,
    maxDrawdown: maxDd,
    maxDrawdownDate: new Date(Date.now() - 8 * 86_400_000)
      .toISOString()
      .slice(0, 10),
    currentDrawdown: -0.8,
    healthFactor,
    distanceToLiquidation:
      distanceToLiquidation != null
        ? parseFloat(distanceToLiquidation.toFixed(2))
        : null,
    riskScore,
  };

  // IL positions (for any LP positions)
  const ilPositions: ILPosition[] = [
    {
      poolId: "xlm-usdc",
      assets: ["XLM", "USDC"],
      ilPct: -2.3,
      ilUsd: totalValue * 0.25 * 0.023,
      hodlValue: totalValue * 0.25 + totalValue * 0.25 * 0.023,
      currentValue: totalValue * 0.25,
    },
  ].filter(() => totalValue > 0);

  // Yield forecast
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
