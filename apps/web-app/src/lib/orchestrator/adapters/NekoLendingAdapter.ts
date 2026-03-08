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
import {
  rpcUrl,
  networkPassphrase,
  allowHttpForSoroban,
} from "@/lib/constants/network";
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

/** Assets that belong to Pool 1 (RWA collateral → borrow USDC/XLM) */
const POOL1_ASSETS = new Set(["USDC", "XLM"]);
/** Assets that belong to Pool 2 (USDC/XLM collateral → borrow RWA) */
const POOL2_ASSETS = new Set(["USTRY", "TESOURO", "CETES", "USDY", "PYUSD"]);

function getPoolContractId(assetCode: string): string {
  return POOL2_ASSETS.has(assetCode)
    ? networks.testnet.pool2ContractId
    : networks.testnet.pool1ContractId;
}

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

  private pool1Client: RwaLendingClient;
  private pool2Client: RwaLendingClient;

  constructor() {
    const clientOptions = {
      rpcUrl,
      networkPassphrase,
      ...(allowHttpForSoroban && { allowHttp: true }),
    };
    this.pool1Client = new RwaLendingClient({
      contractId: networks.testnet.pool1ContractId,
      ...clientOptions,
    });
    this.pool2Client = new RwaLendingClient({
      contractId: networks.testnet.pool2ContractId,
      ...clientOptions,
    });
  }

  private clientFor(assetCode: string): RwaLendingClient {
    return POOL2_ASSETS.has(assetCode) ? this.pool2Client : this.pool1Client;
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

    const client = this.clientFor(assetCode);
    const contractId = getPoolContractId(assetCode);

    try {
      const [balanceTx, interestRateTx, poolStateTx] = await Promise.all([
        client.get_pool_balance({ asset: assetCode }, { simulate: true }),
        client
          .get_interest_rate({ asset: assetCode }, { simulate: true })
          .catch(() => null),
        client.get_pool_state({ simulate: true }).catch(() => null),
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
          contractId,
          assetCode,
        },
      };
    } catch (error) {
      throw new AdapterError("neko", "getPoolInfo", error);
    }
  }

  async listPools(): Promise<PoolInfo[]> {
    const tokens = getAvailableTokens();
    // Pool 1 debt assets; Pool 2 debt assets
    const pool1Assets = ["USDC", "XLM"].filter((c) => tokens[c]?.contract);
    const pool2Assets = ["USTRY", "TESOURO", "CETES", "USDY", "PYUSD"].filter(
      (c) => tokens[c]?.contract
    );
    const allAssets = [...pool1Assets, ...pool2Assets];

    const pools: PoolInfo[] = [];
    for (const code of allAssets) {
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
    const client = this.clientFor(assetCode);

    try {
      const balanceTx = await client.get_b_token_balance(
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
    const contractId = getPoolContractId(assetCode);

    try {
      const xdr = await depositToPool(
        assetCode,
        humanAmount,
        decimals,
        userAddress,
        contractId
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
    const contractId = getPoolContractId(assetCode);

    try {
      const xdr = await withdrawFromPool(
        assetCode,
        humanAmount,
        decimals,
        userAddress,
        contractId
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
