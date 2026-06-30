import { NextResponse, type NextRequest } from "next/server";
import { Horizon } from "@stellar/stellar-sdk";
import { computeDrawdown } from "@/features/analytics/utils/drawdown";
import type {
  NavHistoryApiResponse,
  NavPoint,
  TimeWindow,
} from "@/features/analytics/types/analytics";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const HORIZON_URL =
  process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL ??
  "https://horizon-testnet.stellar.org";

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

interface StellarBalance {
  asset_type: string;
  asset_code?: string;
  balance: string;
}

async function getCurrentNav(address: string): Promise<number> {
  try {
    const server = new Horizon.Server(HORIZON_URL);
    const account = await server.loadAccount(address);
    const balances = account.balances as StellarBalance[];
    let total = 0;
    for (const b of balances) {
      const amount = parseFloat(b.balance ?? "0");
      if (b.asset_type === "native") {
        total += amount * 0.1;
      } else if (
        b.asset_code === "USDC" ||
        b.asset_code === "USDT" ||
        b.asset_code === "EURC"
      ) {
        total += amount;
      } else if (b.asset_code) {
        total += amount * 0.5;
      }
    }
    return total;
  } catch {
    return 1000; // fallback for demo
  }
}

/** Seeded pseudo-random using LCG for deterministic but realistic series. */
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

/** Generate a synthetic NAV series ending at `currentNav`. */
function generateNavSeries(
  days: number,
  currentNav: number,
  dailyDriftPct: number,
  dailyVolPct: number,
  seed: number
): number[] {
  const rand = seededRandom(seed);
  const drift = dailyDriftPct / 100;
  const vol = dailyVolPct / 100;
  const n = Math.max(days, 2);

  // Generate forward series and then scale to end at currentNav
  const raw: number[] = [1];
  for (let i = 1; i < n; i++) {
    const shock = (rand() - 0.5) * 2 * vol;
    raw.push(raw[i - 1] * (1 + drift + shock));
  }

  const endRaw = raw[raw.length - 1];
  const scale = currentNav / endRaw;
  return raw.map((v) => parseFloat((v * scale).toFixed(4)));
}

function isoDate(msAgo: number): string {
  return new Date(Date.now() - msAgo).toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const address = searchParams.get("address");
  const windowParam = (searchParams.get("window") ?? "30d") as TimeWindow;

  if (!address) {
    return NextResponse.json({ error: "address required" }, { status: 400 });
  }

  const days = WINDOW_DAYS[windowParam] ?? 30;
  const currentNav = await getCurrentNav(address);

  // Volatility is higher for shorter windows (more granularity per point)
  const dailyDrift = 0.022; // ~8% annual
  const dailyVol = windowParam === "24h" ? 0.008 : 0.012;

  // Seed based on address + window for consistent but unique series per wallet
  const seed =
    Array.from(address)
      .slice(0, 8)
      .reduce((acc, c) => acc + c.charCodeAt(0), 0) + days;

  const navValues = generateNavSeries(
    days,
    currentNav,
    dailyDrift,
    dailyVol,
    seed
  );
  const { drawdownSeries } = computeDrawdown(navValues);

  const series: NavPoint[] = navValues.map((nav, i) => ({
    date: isoDate((days - 1 - i) * 86_400_000),
    nav,
    drawdown: parseFloat(drawdownSeries[i].toFixed(2)),
  }));

  const response: NavHistoryApiResponse = {
    series,
    window: windowParam,
    generatedAt: new Date().toISOString(),
  };

  return NextResponse.json(response);
}
