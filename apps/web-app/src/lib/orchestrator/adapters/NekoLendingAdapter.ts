/**
 * NekoLendingAdapter — wraps the Neko RWA-Lending contract behind
 * the `BasePoolAdapter` interface.
 *
 * Internally reuses:
 *  - `@neko/lending` generated client for read queries.
 *  - Existing transaction builders from `lib/helpers/lending.ts`
 *    for deposit / withdraw (they return XDR strings).
 */

import { Client as RwaLendingClient, networks } from "@neko/lending";
import { rpcUrl, networkPassphrase } from "@/lib/constants/network";
import { getAvailableTokens } from "@/lib/helpers/stellar/soroswap";
import { fromSmallestUnit } from "@/lib/helpers/tokenUtils";
import { depositToPool, withdrawFromPool } from "@/lib/helpers/stellar/lending";

import type { BasePoolAdapter } from "../types/adapter.types";
import type {
  PoolAction,
  PoolInfo,
  PoolPosition,
  PoolType,
  TransactionResult,
} from "../types/pool.types";
import { AdapterError, UnsupportedActionError } from "../types/errors";

const SUPPORTED_ACTIONS: PoolAction[] = ["deposit", "withdraw"];

/**
 * Unwrap a Stellar SDK `Result<T>` value that may come back as
 * `{ tag, values, unwrap }` or a raw primitive.
 */
function unwrapResult(value: unknown): bigint {
  if (value === null || value === undefined) return 0n;
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  if (typeof value === "string") return BigInt(value);

  const obj = value as {
    tag?: string;
    values?: unknown[];
    unwrap?: () => bigint;
  };

  if (typeof obj.unwrap === "function") {
    try {
      return BigInt(obj.unwrap());
    } catch {
      /* fall through */
    }
  }

  if (obj.tag === "Ok" && Array.isArray(obj.values) && obj.values.length > 0) {
    return BigInt(obj.values[0] as string | number | bigint);
  }

  return 0n;
}

export class NekoLendingAdapter implements BasePoolAdapter {
  readonly type: PoolType = "neko";

  private client: RwaLendingClient;

  constructor() {
    this.client = new RwaLendingClient({
      contractId: networks.testnet.contractId,
      rpcUrl,
      networkPassphrase,
    });
  }

  // ------------------------------------------------------------------
  // Reads
  // ------------------------------------------------------------------

  async getPoolInfo(poolId: string): Promise<PoolInfo> {
    const assetCode = poolId;
    const tokens = getAvailableTokens();
    const token = tokens[assetCode];

    if (!token?.contract) {
      throw new AdapterError(
        "neko",
        "getPoolInfo",
        `Unknown asset: ${assetCode}`
      );
    }

    try {
      const [balanceTx, interestRateTx, poolStateTx] = await Promise.all([
        this.client.get_pool_balance({ asset: assetCode }, { simulate: true }),
        this.client
          .get_interest_rate({ asset: assetCode }, { simulate: true })
          .catch(() => null),
        this.client.get_pool_state({ simulate: true }).catch(() => null),
      ]);

      const balance =
        balanceTx.result != null ? BigInt(String(balanceTx.result)) : 0n;
      const rate = interestRateTx ? unwrapResult(interestRateTx.result) : 0n;
      const stateTag = (poolStateTx?.result as { tag?: string } | undefined)
        ?.tag;

      return {
        id: `neko:${assetCode}`,
        type: "neko",
        name: `${assetCode} Lending Pool`,
        tokens: [
          {
            address: token.contract,
            code: token.code,
            name: token.name,
            decimals: token.decimals,
          },
        ],
        tvl: balance,
        apy: Number(rate) / 100,
        state:
          stateTag === "Active"
            ? "active"
            : stateTag === "Frozen"
              ? "frozen"
              : "unknown",
        supportedActions: SUPPORTED_ACTIONS,
        metadata: {
          contractId: networks.testnet.contractId,
          assetCode,
        },
      };
    } catch (error) {
      throw new AdapterError("neko", "getPoolInfo", error);
    }
  }

  async listPools(): Promise<PoolInfo[]> {
    const tokens = getAvailableTokens();
    const debtAssets = ["USDC", "XLM"].filter((c) => tokens[c]?.contract);

    let stateTag: string | undefined;
    try {
      const stateTx = await this.client.get_pool_state({ simulate: true });
      stateTag = (stateTx.result as { tag?: string } | undefined)?.tag;
    } catch {
      return [];
    }

    if (stateTag !== "Active") return [];

    const pools: PoolInfo[] = [];
    for (const code of debtAssets) {
      try {
        const info = await this.getPoolInfo(code);
        pools.push(info);
      } catch {
        continue;
      }
    }
    return pools;
  }

  async getUserPosition(
    poolId: string,
    userAddress: string
  ): Promise<PoolPosition> {
    const assetCode = poolId;
    const tokens = getAvailableTokens();
    const decimals = tokens[assetCode]?.decimals ?? 7;

    try {
      const balanceTx = await this.client.get_b_token_balance(
        { lender: userAddress, asset: assetCode },
        { simulate: true }
      );
      const raw =
        balanceTx.result != null ? BigInt(String(balanceTx.result)) : 0n;

      return {
        poolId: `neko:${assetCode}`,
        deposited: raw,
        depositedFormatted: fromSmallestUnit(raw.toString(), decimals),
        rewards: 0n,
        rewardsFormatted: "0",
        metadata: { bTokenBalance: raw.toString() },
      };
    } catch {
      return {
        poolId: `neko:${assetCode}`,
        deposited: 0n,
        depositedFormatted: "0",
        rewards: 0n,
        rewardsFormatted: "0",
        metadata: {},
      };
    }
  }

  // ------------------------------------------------------------------
  // Writes — delegate to existing helpers that return XDR strings
  // ------------------------------------------------------------------

  async deposit(
    poolId: string,
    userAddress: string,
    amount: bigint
  ): Promise<TransactionResult> {
    const assetCode = poolId;
    const tokens = getAvailableTokens();
    const decimals = tokens[assetCode]?.decimals ?? 7;
    const humanAmount = fromSmallestUnit(amount.toString(), decimals);

    try {
      const xdr = await depositToPool(
        assetCode,
        humanAmount,
        decimals,
        userAddress
      );
      return { xdr, networkPassphrase };
    } catch (error) {
      throw new AdapterError("neko", "deposit", error);
    }
  }

  async withdraw(
    poolId: string,
    userAddress: string,
    amount: bigint
  ): Promise<TransactionResult> {
    const assetCode = poolId;
    const tokens = getAvailableTokens();
    const decimals = tokens[assetCode]?.decimals ?? 7;
    const humanAmount = fromSmallestUnit(amount.toString(), decimals);

    try {
      const xdr = await withdrawFromPool(
        assetCode,
        humanAmount,
        decimals,
        userAddress
      );
      return { xdr, networkPassphrase };
    } catch (error) {
      throw new AdapterError("neko", "withdraw", error);
    }
  }

  async claimRewards(): Promise<TransactionResult> {
    throw new UnsupportedActionError("neko", "claimRewards");
  }

  supportsAction(action: PoolAction): boolean {
    return SUPPORTED_ACTIONS.includes(action);
  }
}
