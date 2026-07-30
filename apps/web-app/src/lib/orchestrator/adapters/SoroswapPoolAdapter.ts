import {
  getPool,
  addLiquidity,
  removeLiquidity,
  getUserPositions,
  getAvailableTokens,
} from "@/lib/helpers/stellar/soroswap";
import type { UserPositionInfo } from "@/lib/helpers/stellar/soroswap";
import { networkPassphrase } from "@/lib/constants/network";
import { fromSmallestUnit } from "@/lib/helpers/tokenUtils";

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

function parsePairId(poolId: string): { codeA: string; codeB: string } {
  const [codeA, codeB] = poolId.split("-");
  if (!codeA || !codeB) {
    throw new Error(
      `Invalid SoroSwap pool id "${poolId}". Expected format: TOKEN_A-TOKEN_B`
    );
  }
  return { codeA, codeB };
}

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

async function findUserPoolPosition(
  userAddress: string,
  tokenA: TokenInfo,
  tokenB: TokenInfo
): Promise<{ position: UserPositionInfo; aMatchesTokenA: boolean } | null> {
  const positions = await getUserPositions(userAddress);
  for (const position of positions) {
    if (position.poolInformation.protocol !== "soroswap") continue;
    const posA = position.poolInformation.tokenA.address;
    const posB = position.poolInformation.tokenB.address;
    if (posA === tokenA.address && posB === tokenB.address) {
      return { position, aMatchesTokenA: true };
    }
    if (posA === tokenB.address && posB === tokenA.address) {
      return { position, aMatchesTokenA: false };
    }
  }
  return null;
}

function emptyPosition(poolId: string): PoolPosition {
  return {
    poolId,
    deposited: 0n,
    depositedFormatted: "0",
    rewards: 0n,
    rewardsFormatted: "0",
    metadata: {},
  };
}

function applySlippage(amount: bigint, slippageBps: number): bigint {
  return (amount * BigInt(10000 - slippageBps)) / 10000n;
}

export class SoroswapPoolAdapter implements BasePoolAdapter {
  readonly type: PoolType = "soroswap";

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

  async listPools(): Promise<PoolInfo[]> {
    const tokens = getAvailableTokens();
    const codes = Object.keys(tokens);
    const knownPairs: string[] = [];
    for (let i = 0; i < codes.length; i++) {
      for (let j = i + 1; j < codes.length; j++) {
        knownPairs.push(`${codes[i]}-${codes[j]}`);
      }
    }

    // Process in batches of 3 to avoid hitting Soroswap API rate limits (429)
    const BATCH_SIZE = 3;
    const settled: PromiseSettledResult<PoolInfo>[] = [];
    for (let i = 0; i < knownPairs.length; i += BATCH_SIZE) {
      const batch = knownPairs.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.allSettled(
        batch.map((pair) => this.getPoolInfo(pair))
      );
      settled.push(...batchResults);
      if (i + BATCH_SIZE < knownPairs.length) {
        await new Promise((r) => setTimeout(r, 300));
      }
    }

    return settled
      .filter(
        (r): r is PromiseFulfilledResult<PoolInfo> =>
          r.status === "fulfilled" && r.value.state !== "unknown"
      )
      .map((r) => r.value);
  }

  async getUserPosition(
    poolId: string,
    userAddress: string
  ): Promise<PoolPosition> {
    const { codeA, codeB } = parsePairId(poolId);
    const tokenA = resolveToken(codeA);
    const tokenB = resolveToken(codeB);
    const fullId = `soroswap:${poolId}`;

    try {
      const match = await findUserPoolPosition(userAddress, tokenA, tokenB);
      if (!match) {
        return emptyPosition(fullId);
      }

      const { position, aMatchesTokenA } = match;
      const depositedRaw = aMatchesTokenA
        ? position.tokenAAmountEquivalent
        : position.tokenBAmountEquivalent;
      const otherRaw = aMatchesTokenA
        ? position.tokenBAmountEquivalent
        : position.tokenAAmountEquivalent;
      const deposited = BigInt(depositedRaw);

      return {
        poolId: fullId,
        deposited,
        depositedFormatted: fromSmallestUnit(
          deposited.toString(),
          tokenA.decimals
        ),
        rewards: 0n,
        rewardsFormatted: "0",
        metadata: {
          lpShares: position.userPosition,
          userSharesPct: position.userShares,
          otherTokenAmountEquivalent: otherRaw,
          poolAddress: position.poolInformation.address,
        },
      };
    } catch (error) {
      console.error("[SoroswapPoolAdapter] getUserPosition failed:", error);
      return emptyPosition(fullId);
    }
  }

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

  async withdraw(
    poolId: string,
    userAddress: string,
    amount: bigint,
    _tokenIndex?: number
  ): Promise<TransactionResult> {
    const { codeA, codeB } = parsePairId(poolId);
    const tokenA = resolveToken(codeA);
    const tokenB = resolveToken(codeB);

    try {
      const match = await findUserPoolPosition(userAddress, tokenA, tokenB);
      if (!match) {
        throw new Error("No SoroSwap liquidity position found for this pool.");
      }

      const { position, aMatchesTokenA } = match;
      const userLpShares = BigInt(position.userPosition);
      const ourTokenEquivalent = BigInt(
        aMatchesTokenA
          ? position.tokenAAmountEquivalent
          : position.tokenBAmountEquivalent
      );
      const otherTokenEquivalent = BigInt(
        aMatchesTokenA
          ? position.tokenBAmountEquivalent
          : position.tokenAAmountEquivalent
      );

      if (userLpShares <= 0n || ourTokenEquivalent <= 0n) {
        throw new Error("No SoroSwap liquidity position found for this pool.");
      }

      if (amount > ourTokenEquivalent) {
        throw new Error(
          `Withdraw amount exceeds deposited balance (${fromSmallestUnit(ourTokenEquivalent.toString(), tokenA.decimals)} ${tokenA.code}).`
        );
      }

      const isFullWithdraw = amount === ourTokenEquivalent;
      const liquidity = isFullWithdraw
        ? userLpShares
        : (amount * userLpShares) / ourTokenEquivalent;

      if (liquidity <= 0n) {
        throw new Error("Withdraw amount too small to redeem any liquidity.");
      }

      const otherAmountEquivalent = isFullWithdraw
        ? otherTokenEquivalent
        : (otherTokenEquivalent * liquidity) / userLpShares;

      const SLIPPAGE_BPS = 500;
      const minAmountA = applySlippage(
        aMatchesTokenA ? amount : otherAmountEquivalent,
        SLIPPAGE_BPS
      );
      const minAmountB = applySlippage(
        aMatchesTokenA ? otherAmountEquivalent : amount,
        SLIPPAGE_BPS
      );

      const result = await removeLiquidity({
        assetA: tokenA.address,
        assetB: tokenB.address,
        liquidity: liquidity.toString(),
        amountA: minAmountA.toString(),
        amountB: minAmountB.toString(),
        to: userAddress,
        slippageBps: SLIPPAGE_BPS,
      });

      return { xdr: result.xdr, networkPassphrase };
    } catch (error) {
      throw new AdapterError("soroswap", "withdraw", error);
    }
  }

  async claimRewards(): Promise<TransactionResult> {
    throw new UnsupportedActionError("soroswap", "claimRewards");
  }

  supportsAction(action: PoolAction): boolean {
    return SUPPORTED_ACTIONS.includes(action);
  }
}
