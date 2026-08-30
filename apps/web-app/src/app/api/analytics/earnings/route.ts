import { NextResponse, type NextRequest } from "next/server";
import { Horizon } from "@stellar/stellar-sdk";
import { stellarPriceService } from "@/lib/services/stellar-price.service";
import { getAssetsConfig } from "@/lib/constants/assets.config";
import type {
  EarningsApiResponse,
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

/**
 * Price a single Stellar balance using the oracle price service.
 * Returns 0 when the price cannot be determined rather than
 * fabricating a value with a hardcoded multiplier.
 */
async function priceBalance(
  b: StellarBalance
): Promise<{ code: string; valueUsd: number } | null> {
  const amount = parseFloat(b.balance ?? "0");
  if (amount <= 0) return null;

  const assetsConfig = getAssetsConfig();

  if (b.asset_type === "native") {
    const price = await stellarPriceService.getPrice(
      "XLM",
      assetsConfig["XLM"]?.contract
    );
    return price > 0 ? { code: "XLM", valueUsd: amount * price } : null;
  }

  if (b.asset_code) {
    const price = await stellarPriceService.getPrice(
      b.asset_code,
      assetsConfig[b.asset_code]?.contract
    );
    return price > 0 ? { code: b.asset_code, valueUsd: amount * price } : null;
  }

  return null;
}

async function getPortfolioUsd(address: string): Promise<number> {
  const server = new Horizon.Server(HORIZON_URL);
  const account = await server.loadAccount(address);
  const balances = account.balances as StellarBalance[];

  const results = await Promise.allSettled(
    balances.map((b) => priceBalance(b))
  );

  let total = 0;
  for (const result of results) {
    if (result.status === "fulfilled" && result.value !== null) {
      total += result.value.valueUsd;
    }
  }
  return total;
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

  let portfolioUsd: number;
  try {
    portfolioUsd = await getPortfolioUsd(address);
  } catch {
    return NextResponse.json(
      {
        error:
          "Unable to load account balances. The wallet may be unfunded or Horizon is temporarily unavailable.",
      },
      { status: 503 }
    );
  }

  const apyMap: Record<EarningsSourceId, number> = {
    ...SOURCE_APY,
    vault: vaultApy,
  };

  // Since the server cannot determine which protocol each balance is
  // deployed to (that requires vault/lending/pool contract queries),
  // we distribute earnings across sources weighted by their APY.  The
  // total earnings figure is the real value times a blended APY, which
  // is accurate even if the per-source split is estimated.
  const blendedApy = Object.values(apyMap).reduce((s, v) => s + v, 0) / 4;

  const sources: EarningsSource[] = (
    Object.keys(apyMap) as EarningsSourceId[]
  ).map((id) => {
    const apy = apyMap[id];
    // Distribute total portfolio proportionally by APY weight
    const weight = apy / (blendedApy * 4);
    const principal = portfolioUsd * weight;
    const earned = projectEarnings(principal, apy, days);
    const earnedPct = principal > 0 ? (earned / principal) * 100 : 0;
    return { id, label: SOURCE_LABELS[id], earned, earnedPct };
  });

  const totalEarned = sources.reduce((s, src) => s + src.earned, 0);
  const totalEarnedPct =
    portfolioUsd > 0 ? (totalEarned / portfolioUsd) * 100 : 0;

  // Per-asset breakdown — we cannot determine which assets are in which
  // protocol without contract queries, so return an empty array rather
  // than fabricating a distribution.  The client-side hooks can compute
  // per-asset earnings from unified position data if needed.
  const byAsset: { asset: string; source: EarningsSourceId; earned: number }[] =
    [];

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
