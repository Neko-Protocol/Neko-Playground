import { Client as RwaLendingClient, networks } from "@neko/lending";
import {
  rpcUrl,
  networkPassphrase,
  allowHttpForSoroban,
} from "@/lib/constants/network";
import { getAvailableTokens } from "@/lib/helpers/stellar/soroswap";
import { fromSmallestUnit } from "@/lib/helpers/tokenUtils";
import {
  depositToPool,
  withdrawFromPool,
  borrowFromPool,
  repayPool,
  addCollateral,
  removeCollateral,
} from "@/lib/helpers/stellar/lending";

import type { BasePoolAdapter } from "../types/adapter.types";
import type {
  PoolAction,
  PoolInfo,
  PoolPosition,
  PoolType,
  TransactionResult,
} from "../types/pool.types";
import { AdapterError, UnsupportedActionError } from "../types/errors";

const SUPPORTED_ACTIONS: PoolAction[] = [
  "deposit",
  "withdraw",
  "borrow",
  "repay",
  "supplyCollateral",
  "withdrawCollateral",
];

const D_TOKEN_SCALAR_12 = 1_000_000_000_000n;

/** Collateral is keyed by (pool contract, RWA token), not a single asset code — mirrors Blend's <poolContractId>:<assetAddress> raw-id convention. */
function parseCollateralRawId(rawId: string): {
  contractId: string;
  tokenAddress: string;
} {
  const idx = rawId.indexOf(":");
  if (idx === -1) {
    throw new AdapterError(
      "neko",
      "parseCollateralRawId",
      `Invalid raw id "${rawId}" — expected <poolContractId>:<rwaTokenAddress>`
    );
  }
  return {
    contractId: rawId.slice(0, idx),
    tokenAddress: rawId.slice(idx + 1),
  };
}

/** Assets that belong to Pool 1 (RWA collateral → borrow USDC/XLM) */
const POOL1_ASSETS = new Set(["USDC", "XLM"]);
/** Assets that belong to Pool 2 (USDC/XLM collateral → borrow RWA) */
const POOL2_ASSETS = new Set([
  "USTRY",
  "TESOURO",
  "CETES",
  "USDY",
  "PYUSD",
  "KTB",
]);

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
    } catch {}
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
    const pool2Assets = [
      "USTRY",
      "TESOURO",
      "CETES",
      "USDY",
      "PYUSD",
      "KTB",
    ].filter((c) => tokens[c]?.contract);
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

  async borrow(
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
      const xdr = await borrowFromPool(
        assetCode,
        humanAmount,
        decimals,
        userAddress,
        contractId
      );
      return { xdr, networkPassphrase };
    } catch (error) {
      throw new AdapterError("neko", "borrow", error);
    }
  }

  /**
   * `amount` is underlying-asset units (matching Blend's repay contract), not
   * dTokens — the on-chain repay() call takes dTokens, so it's derived here
   * via the pool's own d_token rate rather than the pool-unaware
   * `getDTokenRate` helper in lending.ts.
   */
  async repay(
    poolId: string,
    userAddress: string,
    amount: bigint
  ): Promise<TransactionResult> {
    const assetCode = poolId;
    const contractId = getPoolContractId(assetCode);
    const client = this.clientFor(assetCode);

    try {
      const rateTx = await client.get_d_token_rate(
        { asset: assetCode },
        { simulate: true }
      );
      const dRate = unwrapResult(rateTx.result);
      if (dRate <= 0n) {
        throw new Error(`No active debt / d-token rate for ${assetCode}`);
      }
      const dTokens = (amount * D_TOKEN_SCALAR_12) / dRate;
      const xdr = await repayPool(assetCode, dTokens, userAddress, contractId);
      return { xdr, networkPassphrase };
    } catch (error) {
      throw new AdapterError("neko", "repay", error);
    }
  }

  /** poolId here is "<poolContractId>:<rwaTokenAddress>" — see parseCollateralRawId. */
  async supplyCollateral(
    poolId: string,
    userAddress: string,
    amount: bigint
  ): Promise<TransactionResult> {
    const { contractId, tokenAddress } = parseCollateralRawId(poolId);
    const decimals = 7;
    const humanAmount = fromSmallestUnit(amount.toString(), decimals);

    try {
      const xdr = await addCollateral(
        tokenAddress,
        humanAmount,
        decimals,
        userAddress,
        contractId
      );
      return { xdr, networkPassphrase };
    } catch (error) {
      throw new AdapterError("neko", "supplyCollateral", error);
    }
  }

  async withdrawCollateral(
    poolId: string,
    userAddress: string,
    amount: bigint
  ): Promise<TransactionResult> {
    const { contractId, tokenAddress } = parseCollateralRawId(poolId);
    const decimals = 7;
    const humanAmount = fromSmallestUnit(amount.toString(), decimals);

    try {
      const xdr = await removeCollateral(
        tokenAddress,
        humanAmount,
        decimals,
        userAddress,
        contractId
      );
      return { xdr, networkPassphrase };
    } catch (error) {
      throw new AdapterError("neko", "withdrawCollateral", error);
    }
  }

  supportsAction(action: PoolAction): boolean {
    return SUPPORTED_ACTIONS.includes(action);
  }
}
