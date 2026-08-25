import { NextResponse, type NextRequest } from "next/server";
import { Horizon } from "@stellar/stellar-sdk";
import type {
  EarningsApiResponse,
  EarningsByAsset,
  EarningsSource,
  EarningsSourceId,
  TimeWindow,
} from "@/features/analytics/types/analytics";
import { clientEnv } from "@/lib/env.client";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const HORIZON_URL = clientEnv.horizonUrl;

const WINDOW_DAYS: Record<TimeWindow, number> = {
  "24h": 1,
  "7d": 7,
  "30d": 30,
  ytd: Math.ceil(
    (Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) /
      86_400_000
  ),
  all: 365,
};

// Protocol-level APY estimates per source (updated via vault/apy in production)
const SOURCE_APY: Record<EarningsSourceId, number> = {
  vault: 7.5,
  lending: 8.2,
  pools: 12.4,
  rwa: 4.8,
};

const SOURCE_LABELS: Record<EarningsSourceId, string> = {
  vault: "Vault",
  lending: "Lending",
  pools: "Pools",
  rwa: "RWA",
};

interface StellarBalance {
  asset_type: string;
  asset_code?: string;
  balance: string;
}

async function getPortfolioUsd(address: string): Promise<number> {
  try {
    const server = new Horizon.Server(HORIZON_URL);
    const account = await server.loadAccount(address);
    const balances = account.balances as StellarBalance[];

    // Simple estimate: XLM at $0.10 + stablecoins at $1.00
    let total = 0;
    for (const b of balances) {
      const amount = parseFloat(b.balance ?? "0");
      if (b.asset_type === "native") {
        total += amount * 0.1; // XLM estimate
      } else if (
        b.asset_code === "USDC" ||
        b.asset_code === "USDT" ||
        b.asset_code === "EURC"
      ) {
        total += amount;
      } else if (b.asset_code) {
        total += amount * 0.5; // conservative estimate for other tokens
      }
    }
    return total;
  } catch {
    return 0;
  }
}

function projectEarnings(
  principal: number,
  apyPct: number,
  days: number
): number {
  const apy = apyPct / 100;
  return principal * (Math.pow(1 + apy, days / 365) - 1);
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const address = searchParams.get("address");
  const windowParam = (searchParams.get("window") ?? "30d") as TimeWindow;

  if (!address) {
    return NextResponse.json({ error: "address required" }, { status: 400 });
  }

  const days = WINDOW_DAYS[windowParam] ?? 30;

  // Fetch vault APY from existing endpoint if possible
  let vaultApy = SOURCE_APY.vault;
  try {
    const origin = req.nextUrl.origin;
    const apyRes = await fetch(`${origin}/api/vault/apy`, {
      next: { revalidate: 300 },
    });
    if (apyRes.ok) {
      const apyData = await apyRes.json();
      if (apyData.vaultApy != null) vaultApy = apyData.vaultApy;
    }
  } catch {
    // fallback to default
  }

  const portfolioUsd = await getPortfolioUsd(address);

  // Allocate portfolio across sources (estimated)
  const allocation: Record<EarningsSourceId, number> = {
    vault: portfolioUsd * 0.35,
    lending: portfolioUsd * 0.3,
    pools: portfolioUsd * 0.25,
    rwa: portfolioUsd * 0.1,
  };

  const apyMap: Record<EarningsSourceId, number> = {
    ...SOURCE_APY,
    vault: vaultApy,
  };

  const sources: EarningsSource[] = (
    Object.keys(allocation) as EarningsSourceId[]
  ).map((id) => {
    const principal = allocation[id];
    const apy = apyMap[id];
    const earned = projectEarnings(principal, apy, days);
    const earnedPct = principal > 0 ? (earned / principal) * 100 : 0;
    return { id, label: SOURCE_LABELS[id], earned, earnedPct };
  });

  const totalEarned = sources.reduce((s, src) => s + src.earned, 0);
  const totalEarnedPct =
    portfolioUsd > 0 ? (totalEarned / portfolioUsd) * 100 : 0;

  // Per-asset breakdown (realistic token list)
  // `satisfies` restores contextual typing the trailing .filter() would
  // otherwise swallow, so each `source` narrows to EarningsSourceId instead of
  // widening to string — and a typo in one is caught here.
  const byAsset: EarningsByAsset[] = (
    [
      { asset: "USDC", source: "vault", earned: sources[0].earned * 0.6 },
      { asset: "XLM", source: "vault", earned: sources[0].earned * 0.4 },
      { asset: "USDC", source: "lending", earned: sources[1].earned * 0.7 },
      { asset: "EURC", source: "lending", earned: sources[1].earned * 0.3 },
      { asset: "XLM/USDC", source: "pools", earned: sources[2].earned * 0.55 },
      { asset: "EURC/USDC", source: "pools", earned: sources[2].earned * 0.45 },
      { asset: "CETES", source: "rwa", earned: sources[3].earned },
    ] satisfies EarningsByAsset[]
  ).filter((r) => r.earned > 0.000001);

  const response: EarningsApiResponse = {
    totalEarned,
    totalEarnedPct,
    sources,
    byAsset,
    window: windowParam,
    generatedAt: new Date().toISOString(),
  };

  return NextResponse.json(response);
}
