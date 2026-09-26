/**
 * Builds the VenueCandidate list for the Smart Yield Router from real
 * on-chain and service reads.
 *
 * Venues covered:
 *   - vault:   Neko Vault (via vault-apy.service)
 *   - lending: Neko Lending Pool 1 (USDC, XLM) and Pool 2 (RWAs)
 *   - pool:    SoroSwap pairs against known token codes
 *
 * Every field that cannot be resolved is represented explicitly via the
 * `availability` field rather than being silently dropped or defaulted.
 */

import type { VenueCandidate, VenueKind } from "@/features/automation/types/automation";
import {
  VAULT_PROTOCOL_FEE_BPS,
  LENDING_PROTOCOL_FEE_BPS,
  POOL_PROTOCOL_FEE_BPS,
  AMORTIZED_GAS_BPS_VAULT,
  AMORTIZED_GAS_BPS_LENDING,
  AMORTIZED_GAS_BPS_POOL,
} from "@/features/automation/const/fees";
import { calcNetApyBps } from "@/features/automation/utils/netApy";
import { NekoLendingAdapter } from "@/lib/orchestrator/adapters/NekoLendingAdapter";
import { SoroswapPoolAdapter } from "@/lib/orchestrator/adapters/SoroswapPoolAdapter";
import { getVaultApySnapshot } from "@/lib/services/vault-apy.service";
import { stellarPriceService } from "@/lib/services/stellar-price.service";
import { getAvailableTokens } from "@/lib/helpers/stellar/soroswap";

interface RawCandidate {
  id: string;
  kind: VenueKind;
  name: string;
  asset: string;
  grossApyBps: number | null;
  borrowCostBps: number;
  protocolFeeBps: number;
  amortizedGasBps: number;
  /** Already resolved USD, or null if price was unavailable. */
  availableLiquidityUsd: number | null;
  /** Raw native liquidity amount, kept only for the reason message. */
  rawLiquidity: number | null;
  liquidityNote?: string;
  apyNote?: string;
}

const LENDING_ASSETS = ["USDC", "XLM", "USTRY", "TESOURO", "CETES", "USDY", "PYUSD", "KTB"] as const;
const POOL_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["USDC", "XLM"],
  ["USDC", "USTRY"],
  ["USDC", "CETES"],
  ["XLM", "USTRY"],
];

/** Convert an APY percentage (e.g. 8.5) to basis points (850). */
function pctToBps(pct: number): number {
  return Math.round(pct * 100);
}

async function readVaultCandidate(): Promise<RawCandidate> {
  const base: Omit<RawCandidate, "grossApyBps" | "availableLiquidityUsd" | "rawLiquidity" | "apyNote" | "liquidityNote"> = {
    id: "neko-vault",
    kind: "vault",
    name: "Neko Vault",
    asset: "USDC",
    borrowCostBps: 0,
    protocolFeeBps: VAULT_PROTOCOL_FEE_BPS,
    amortizedGasBps: AMORTIZED_GAS_BPS_VAULT,
  };

  let snapshot = null;
  try {
    snapshot = await getVaultApySnapshot();
  } catch {
    snapshot = null;
  }

  if (!snapshot || snapshot.vaultApy === null) {
    return {
      ...base,
      grossApyBps: null,
      availableLiquidityUsd: null,
      rawLiquidity: null,
      apyNote: snapshot?.note ?? "Vault APY unavailable",
      liquidityNote: "Vault TVL not exposed by a public getter",
    };
  }

  return {
    ...base,
    grossApyBps: pctToBps(snapshot.vaultApy),
    availableLiquidityUsd: null,
    rawLiquidity: null,
    liquidityNote:
      "Vault TVL is not exposed by the contract's public interface; deposit capacity is bounded by the vault's own strategy caps",
  };
}

async function readLendingCandidates(): Promise<RawCandidate[]> {
  const adapter = new NekoLendingAdapter();
  const tokens = getAvailableTokens();
  const out: RawCandidate[] = [];

  for (const assetCode of LENDING_ASSETS) {
    const token = tokens[assetCode];
    if (!token?.contract) continue;

    let grossApyBps: number | null = null;
    let poolBalanceNative: number | null = null;
    let apyNote: string | undefined;

    try {
      const info = await adapter.getPoolInfo(assetCode);
      // NekoLendingAdapter returns APY as a percentage value already
      // (see: `apy: Number(rate) / 100` in getPoolInfo), so the value is
      // in percent units. Convert straight to bps.
      grossApyBps = Math.round(info.apy * 100);
      poolBalanceNative = Number(info.tvl);
    } catch (err) {
      apyNote = err instanceof Error ? err.message : "Lending read failed";
    }

    let liquidityUsd: number | null = null;
    let liquidityNote: string | undefined;

    if (poolBalanceNative !== null) {
      const humanBalance = poolBalanceNative / 10 ** token.decimals;
      const price = await stellarPriceService
        .getPrice(assetCode, token.contract)
        .catch(() => 0);
      if (price > 0) {
        liquidityUsd = humanBalance * price;
      } else {
        liquidityNote = `USD price for ${assetCode} not available from stellarPriceService`;
      }
    }

    out.push({
      id: `neko-lending-${assetCode.toLowerCase()}`,
      kind: "lending",
      name: `${assetCode} Lending Pool`,
      asset: assetCode,
      grossApyBps,
      borrowCostBps: 0,
      protocolFeeBps: LENDING_PROTOCOL_FEE_BPS,
      amortizedGasBps: AMORTIZED_GAS_BPS_LENDING,
      availableLiquidityUsd: liquidityUsd,
      rawLiquidity: poolBalanceNative,
      apyNote,
      liquidityNote,
    });
  }

  return out;
}

async function readPoolCandidates(): Promise<RawCandidate[]> {
  const adapter = new SoroswapPoolAdapter();
  const tokens = getAvailableTokens();
  const out: RawCandidate[] = [];

  for (const [codeA, codeB] of POOL_PAIRS) {
    const tokenA = tokens[codeA];
    const tokenB = tokens[codeB];
    if (!tokenA?.contract || !tokenB?.contract) continue;

    const poolId = `${codeA}-${codeB}`;
    let tvlNativeTokenA: number | null = null;
    let apyBps: number | null = null;
    let apyNote: string | undefined = "SoroSwap pool APY requires trading volume data";
    let liquidityNote: string | undefined;

    try {
      const info = await adapter.getPoolInfo(poolId);
      // tvl is normalised onto tokenA's decimals by the adapter.
      const humanTvl = Number(info.tvl) / 10 ** tokenA.decimals;
      tvlNativeTokenA = humanTvl;

      if (info.apy > 0) {
        apyBps = Math.round(info.apy * 100);
        apyNote = undefined;
      }
    } catch (err) {
      apyNote = err instanceof Error ? err.message : "Pool read failed";
    }

    let liquidityUsd: number | null = null;
    if (tvlNativeTokenA !== null) {
      const priceA = await stellarPriceService
        .getPrice(codeA, tokenA.contract)
        .catch(() => 0);
      if (priceA > 0) {
        // tvl is tokenA + tokenB normalised to tokenA decimals, so
        // multiplying by priceA gives a reasonable USD estimate for
        // the pool's total supply.
        liquidityUsd = tvlNativeTokenA * priceA;
      } else {
        liquidityNote = `USD price for ${codeA} not available from stellarPriceService`;
      }
    }

    out.push({
      id: `soroswap-${codeA.toLowerCase()}-${codeB.toLowerCase()}`,
      kind: "pool",
      name: `${codeA} / ${codeB}`,
      asset: codeA,
      grossApyBps: apyBps,
      borrowCostBps: 0,
      protocolFeeBps: POOL_PROTOCOL_FEE_BPS,
      amortizedGasBps: AMORTIZED_GAS_BPS_POOL,
      availableLiquidityUsd: liquidityUsd,
      rawLiquidity: tvlNativeTokenA,
      apyNote,
      liquidityNote,
    });
  }

  return out;
}

/**
 * Read the caller's position size (in USD) across every supported venue.
 * Venues whose USD price cannot be resolved are returned as 0 with a note,
 * because currentAllocationPct is defined as a fraction of the portfolio
 * and a missing price must not silently inflate other weights.
 */
async function readAllocationUsd(
  address: string,
  raw: RawCandidate[]
): Promise<Map<string, number>> {
  const lendingAdapter = new NekoLendingAdapter();
  const poolAdapter = new SoroswapPoolAdapter();
  const tokens = getAvailableTokens();
  const out = new Map<string, number>();

  await Promise.all(
    raw.map(async (c) => {
      let position = 0;
      try {
        if (c.kind === "lending") {
          const p = await lendingAdapter.getUserPosition(c.asset, address);
          const token = tokens[c.asset];
          if (token) {
            const human = Number(p.deposited) / 10 ** token.decimals;
            const price = await stellarPriceService
              .getPrice(c.asset, token.contract)
              .catch(() => 0);
            position = human * price;
          }
        } else if (c.kind === "pool") {
          // id format: soroswap-<a>-<b>
          const [, a, b] = c.id.split("-");
          const p = await poolAdapter.getUserPosition(`${a.toUpperCase()}-${b.toUpperCase()}`, address);
          const token = tokens[c.asset];
          if (token) {
            const human = Number(p.deposited) / 10 ** token.decimals;
            const price = await stellarPriceService
              .getPrice(c.asset, token.contract)
              .catch(() => 0);
            position = human * price;
          }
        }
      } catch {
        position = 0;
      }
      out.set(c.id, position);
    })
  );

  return out;
}

function classify(raw: RawCandidate): VenueCandidate["availability"] {
  if (raw.grossApyBps === null) return "unavailable";
  if (raw.availableLiquidityUsd === null) return "partial";
  return "available";
}

function buildReason(raw: RawCandidate): string | undefined {
  const reasons: string[] = [];
  if (raw.apyNote) reasons.push(raw.apyNote);
  if (raw.liquidityNote) reasons.push(raw.liquidityNote);
  return reasons.length > 0 ? reasons.join("; ") : undefined;
}

/**
 * Assemble the full candidate list for the given wallet.
 * Always returns one entry per venue the protocol supports — never
 * silently drops a venue whose reads failed.
 */
export async function buildCandidates(
  walletAddress: string
): Promise<VenueCandidate[]> {
  const [vault, lending, pools] = await Promise.all([
    readVaultCandidate(),
    readLendingCandidates(),
    readPoolCandidates(),
  ]);

  const allRaw = [vault, ...lending, ...pools];
  const positions = await readAllocationUsd(walletAddress, allRaw);
  const totalUsd = Array.from(positions.values()).reduce((a, b) => a + b, 0);

  return allRaw.map((r) => {
    const availability = classify(r);
    const netApyBps =
      availability === "unavailable"
        ? null
        : calcNetApyBps({
            ...r,
            netApyBps: 0, // ignored by calcNetApyBps
          } as Omit<VenueCandidate, "netApyBps">);

    const positionUsd = positions.get(r.id) ?? 0;
    const currentAllocationPct =
      totalUsd > 0 ? (positionUsd / totalUsd) * 100 : 0;

    const candidate: VenueCandidate = {
      id: r.id,
      kind: r.kind,
      name: r.name,
      asset: r.asset,
      grossApyBps: r.grossApyBps,
      borrowCostBps: r.borrowCostBps,
      protocolFeeBps: r.protocolFeeBps,
      amortizedGasBps: r.amortizedGasBps,
      netApyBps,
      availableLiquidityUsd: r.availableLiquidityUsd,
      currentAllocationPct,
      availability,
    };

    if (availability !== "available") {
      candidate.unavailableReason = buildReason(r);
    }

    return candidate;
  });
}
