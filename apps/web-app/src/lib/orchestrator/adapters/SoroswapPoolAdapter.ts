/**
 * SoroswapPoolAdapter — wraps the SoroSwap SDK / API helpers
 * behind the `BasePoolAdapter` interface.
 *
 * SoroSwap pools are AMM liquidity pools with token pairs.
 * This adapter delegates to the existing helper functions in
 * `lib/helpers/soroswap.ts` for pool queries and liquidity ops.
 */

import {
  getPool,
  addLiquidity,
  getAvailableTokens,
} from "@/lib/helpers/stellar/soroswap";
import { networkPassphrase } from "@/lib/constants/network";
import { fromSmallestUnit } from "@/lib/helpers/stellar/tokenUtils";

import type { BasePoolAdapter } from "../types/adapter.types";
import type {
  PoolAction,
  PoolInfo,
  PoolPosition,
  PoolType,
  TokenInfo,
  TransactionResult,
} from "../types/pool.types";
import { AdapterError, UnsupportedActionError } from "../types/errors";

const SUPPORTED_ACTIONS: PoolAction[] = ["deposit", "withdraw"];

/**
 * Parse a SoroSwap pool id.
 * Expected format: `<tokenACode>-<tokenBCode>` (e.g. `XLM-USDC`).
 */
function parsePairId(poolId: string): { codeA: string; codeB: string } {
  const [codeA, codeB] = poolId.split("-");
  if (!codeA || !codeB) {
    throw new Error(
      `Invalid SoroSwap pool id "${poolId}". Expected format: TOKEN_A-TOKEN_B`
    );
  }
  return { codeA, codeB };
}

/** Resolve a token code to its on-chain TokenInfo. */
function resolveToken(code: string): TokenInfo {
  const tokens = getAvailableTokens();
  const t = tokens[code];
  if (!t?.contract) {
    throw new Error(`Unknown token code: ${code}`);
  }
  return {
    address: t.contract,
    code: t.code,
    name: t.name,
    decimals: t.decimals,
  };
}

export class SoroswapPoolAdapter implements BasePoolAdapter {
  readonly type: PoolType = "soroswap";

  // ------------------------------------------------------------------
  // Reads
  // ------------------------------------------------------------------

  async getPoolInfo(poolId: string): Promise<PoolInfo> {
    const { codeA, codeB } = parsePairId(poolId);
    const tokenA = resolveToken(codeA);
    const tokenB = resolveToken(codeB);

    try {
      const pools = await getPool({
        tokenA: tokenA.address,
        tokenB: tokenB.address,
      });

      if (!pools.length) {
        return {
          id: `soroswap:${poolId}`,
          type: "soroswap",
          name: `${codeA} / ${codeB}`,
          tokens: [tokenA, tokenB],
          tvl: 0n,
          apy: 0,
          state: "unknown",
          supportedActions: SUPPORTED_ACTIONS,
          metadata: { exists: false },
        };
      }

      const pool = pools[0];
      const reserveA = BigInt(pool.reserveA);
      const reserveB = BigInt(pool.reserveB);

      return {
        id: `soroswap:${poolId}`,
        type: "soroswap",
        name: `${codeA} / ${codeB}`,
        tokens: [tokenA, tokenB],
        tvl: reserveA + reserveB,
        apy: 0,
        state: "active",
        supportedActions: SUPPORTED_ACTIONS,
        metadata: {
          poolAddress: pool.address,
          protocol: pool.protocol,
          reserveA: pool.reserveA,
          reserveB: pool.reserveB,
          reserveAFormatted: fromSmallestUnit(
            reserveA.toString(),
            tokenA.decimals
          ),
          reserveBFormatted: fromSmallestUnit(
            reserveB.toString(),
            tokenB.decimals
          ),
          ledger: pool.ledger,
        },
      };
    } catch (error) {
      throw new AdapterError("soroswap", "getPoolInfo", error);
    }
  }

  /**
   * List known SoroSwap pools for every pair combination
   * of the protocol's configured tokens.
   *
   * Currently queries a curated set of likely pairs. Extend
   * this list or switch to an "all-pools" API when available.
   */
  async listPools(): Promise<PoolInfo[]> {
    const knownPairs = [
      "XLM-USDC",
      "XLM-NVDA",
      "XLM-AAPL",
      "USDC-NVDA",
      "USDC-AAPL",
    ];

    const results = await Promise.allSettled(
      knownPairs.map((pair) => this.getPoolInfo(pair))
    );

    return results
      .filter(
        (r): r is PromiseFulfilledResult<PoolInfo> =>
          r.status === "fulfilled" && r.value.state !== "unknown"
      )
      .map((r) => r.value);
  }

  /**
   * SoroSwap does not expose per-user LP position via a simple
   * query right now, so we return a zeroed position.
   * Future: query LP token balance for the user.
   */
  async getUserPosition(
    poolId: string,
    _userAddress: string
  ): Promise<PoolPosition> {
    return {
      poolId: `soroswap:${poolId}`,
      deposited: 0n,
      depositedFormatted: "0",
      rewards: 0n,
      rewardsFormatted: "0",
      metadata: {},
    };
  }

  // ------------------------------------------------------------------
  // Writes
  // ------------------------------------------------------------------

  /**
   * Deposit (add liquidity) to a SoroSwap pool.
   *
   * Because SoroSwap pools are dual-token, the caller must supply
   * `amount` as the **tokenA** amount; the SDK computes the required
   * tokenB amount internally through the `addLiquidity` helper.
   *
   * @param tokenIndex - Ignored for SoroSwap (both tokens required).
   */
  async deposit(
    poolId: string,
    userAddress: string,
    amount: bigint,
    _tokenIndex?: number
  ): Promise<TransactionResult> {
    const { codeA, codeB } = parsePairId(poolId);
    const tokenA = resolveToken(codeA);
    const tokenB = resolveToken(codeB);

    const humanAmountA = fromSmallestUnit(amount.toString(), tokenA.decimals);
    const humanAmountB = humanAmountA;

    try {
      const result = await addLiquidity({
        assetA: tokenA.address,
        assetB: tokenB.address,
        amountA: humanAmountA,
        amountB: humanAmountB,
        to: userAddress,
      });

      return { xdr: result.xdr, networkPassphrase };
    } catch (error) {
      throw new AdapterError("soroswap", "deposit", error);
    }
  }

  /**
   * Withdraw (remove liquidity) is not yet exposed by the SoroSwap
   * REST API used in this codebase. Throws until implemented.
   */
  async withdraw(): Promise<TransactionResult> {
    throw new UnsupportedActionError(
      "soroswap",
      "withdraw (remove liquidity not yet available via API)"
    );
  }

  async claimRewards(): Promise<TransactionResult> {
    throw new UnsupportedActionError("soroswap", "claimRewards");
  }

  supportsAction(action: PoolAction): boolean {
    if (action === "withdraw") return false;
    return SUPPORTED_ACTIONS.includes(action);
  }
}
