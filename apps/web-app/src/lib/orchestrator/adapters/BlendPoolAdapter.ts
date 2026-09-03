import {
  PoolV2,
  PoolContractV2,
  PositionsEstimate,
  RequestType,
  TokenMetadata,
  type PoolUser,
  type Request,
  type Reserve,
} from "@blend-capital/blend-sdk";
import { TransactionBuilder, xdr, Horizon } from "@stellar/stellar-sdk";

import { rpcUrl, networkPassphrase, horizonUrl } from "@/lib/constants/network";
import { getSorobanServer } from "@/lib/helpers/stellar/sorobanServer";

import type { BasePoolAdapter } from "../types/adapter.types";
import type {
  PoolAction,
  PoolActionLimits,
  PoolInfo,
  PoolPosition,
  PoolType,
  TransactionResult,
} from "../types/pool.types";
import { AdapterError, UnsupportedActionError } from "../types/errors";
import { getBlendNetwork } from "./blend-config";

const SUPPORTED_ACTIONS: PoolAction[] = [
  "deposit",
  "withdraw",
  "supplyCollateral",
  "withdrawCollateral",
  "borrow",
  "repay",
  "claimRewards",
];

const REQUEST_TYPE_MAP: Record<string, RequestType> = {
  deposit: RequestType.Supply,
  withdraw: RequestType.Withdraw,
  supplyCollateral: RequestType.SupplyCollateral,
  withdrawCollateral: RequestType.WithdrawCollateral,
  borrow: RequestType.Borrow,
  repay: RequestType.Repay,
};

function parseRawId(rawId: string): {
  poolContractId: string;
  assetAddress: string;
} {
  const idx = rawId.indexOf(":");
  if (idx === -1) {
    throw new AdapterError(
      "blend",
      "parseRawId",
      `Invalid raw id "${rawId}" — expected <poolContractId>:<assetAddress>`
    );
  }
  return {
    poolContractId: rawId.slice(0, idx),
    assetAddress: rawId.slice(idx + 1),
  };
}

export class BlendPoolAdapter implements BasePoolAdapter {
  readonly type: PoolType = "blend";

  private poolContractId: string;

  constructor(poolContractId: string) {
    this.poolContractId = poolContractId;
  }

  async getPoolInfo(rawId: string): Promise<PoolInfo> {
    const { poolContractId, assetAddress } = parseRawId(rawId);
    const network = getBlendNetwork();

    try {
      const pool = await PoolV2.load(network, poolContractId);
      const reserve = pool.reserves.get(assetAddress);

      if (!reserve) {
        throw new AdapterError(
          "blend",
          "getPoolInfo",
          `Reserve ${assetAddress} not found in pool ${poolContractId}`
        );
      }

      let tokenMeta: TokenMetadata | undefined;
      try {
        tokenMeta = await TokenMetadata.load(network, assetAddress);
      } catch {}

      const statusMap: Record<number, "active" | "frozen" | "on_ice"> = {
        0: "active",
        2: "on_ice",
        4: "frozen",
      };

      return {
        id: `blend:${poolContractId}:${assetAddress}`,
        type: "blend",
        name: `${tokenMeta?.symbol ?? assetAddress.slice(0, 8)} Blend Pool`,
        tokens: [
          {
            address: assetAddress,
            code: tokenMeta?.symbol ?? "UNKNOWN",
            name: tokenMeta?.name ?? assetAddress,
            decimals: tokenMeta?.decimals ?? reserve.config.decimals,
          },
        ],
        tvl: reserve.totalSupply(),
        apy: reserve.estSupplyApy * 100,
        state: statusMap[pool.metadata.status] ?? "unknown",
        supportedActions: SUPPORTED_ACTIONS,
        metadata: {
          poolContractId,
          assetAddress,
          borrowApy: reserve.estBorrowApy * 100,
          supplyApy: reserve.estSupplyApy * 100,
          cFactor: reserve.getCollateralFactor(),
          lFactor: reserve.getLiabilityFactor(),
          totalLiabilities: reserve.totalLiabilities().toString(),
          utilization: reserve.getUtilizationFloat(),
          poolName: pool.metadata.name,
        },
      };
    } catch (error) {
      if (error instanceof AdapterError) throw error;
      throw new AdapterError("blend", "getPoolInfo", error);
    }
  }

  async listPools(): Promise<PoolInfo[]> {
    const network = getBlendNetwork();

    try {
      const pool = await PoolV2.load(network, this.poolContractId);
      const pools: PoolInfo[] = [];

      for (const [assetAddress, reserve] of pool.reserves) {
        let tokenMeta: TokenMetadata | undefined;
        try {
          tokenMeta = await TokenMetadata.load(network, assetAddress);
        } catch {}

        const statusMap: Record<number, "active" | "frozen" | "on_ice"> = {
          0: "active",
          2: "on_ice",
          4: "frozen",
        };

        pools.push({
          id: `blend:${this.poolContractId}:${assetAddress}`,
          type: "blend",
          name: `${tokenMeta?.symbol ?? assetAddress.slice(0, 8)} Blend Pool`,
          tokens: [
            {
              address: assetAddress,
              code: tokenMeta?.symbol ?? "UNKNOWN",
              name: tokenMeta?.name ?? assetAddress,
              decimals: tokenMeta?.decimals ?? reserve.config.decimals,
            },
          ],
          tvl: reserve.totalSupply(),
          apy: reserve.estSupplyApy * 100,
          state: statusMap[pool.metadata.status] ?? "unknown",
          supportedActions: SUPPORTED_ACTIONS,
          metadata: {
            poolContractId: this.poolContractId,
            assetAddress,
            borrowApy: reserve.estBorrowApy * 100,
            supplyApy: reserve.estSupplyApy * 100,
            cFactor: reserve.getCollateralFactor(),
            lFactor: reserve.getLiabilityFactor(),
            totalLiabilities: reserve.totalLiabilities().toString(),
            utilization: reserve.getUtilizationFloat(),
            poolName: pool.metadata.name,
          },
        });
      }

      return pools;
    } catch (error) {
      console.error("[BlendPoolAdapter] listPools failed:", error);
      return [];
    }
  }

  async getUserPosition(
    rawId: string,
    userAddress: string
  ): Promise<PoolPosition> {
    const { poolContractId, assetAddress } = parseRawId(rawId);
    const network = getBlendNetwork();
    const fullId = `blend:${poolContractId}:${assetAddress}`;

    try {
      const pool = await PoolV2.load(network, poolContractId);
      const reserve = pool.reserves.get(assetAddress);

      if (!reserve) {
        return emptyPosition(fullId);
      }

      const poolUser = await pool.loadUser(userAddress);
      const supplied = poolUser.getSupply(reserve);
      const collateral = poolUser.getCollateral(reserve);
      const liabilities = poolUser.getLiabilities(reserve);
      const { claimedTokens } = poolUser.estimateEmissions(
        Array.from(pool.reserves.values())
      );

      const decimals = reserve.config.decimals;

      // Display total only. Supply and collateral are two separate on-chain
      // balances and no single request moves both — action amounts come from
      // `limits`, never from here.
      const deposited = supplied + collateral;

      const limits = await deriveLimits(pool, reserve, poolUser, {
        supplied,
        collateral,
        liabilities,
      });

      return {
        poolId: fullId,
        deposited,
        depositedFormatted: formatUnits(deposited, decimals),
        supplied,
        suppliedFormatted: formatUnits(supplied, decimals),
        collateral,
        collateralFormatted: formatUnits(collateral, decimals),
        liabilities,
        liabilitiesFormatted: formatUnits(liabilities, decimals),
        rewards: 0n,
        rewardsFormatted: "0",
        limits,
        metadata: {
          supplied: supplied.toString(),
          collateral: collateral.toString(),
          liabilities: liabilities.toString(),
          claimedTokens,
        },
      };
    } catch {
      return emptyPosition(fullId);
    }
  }

  async deposit(
    rawId: string,
    userAddress: string,
    amount: bigint
  ): Promise<TransactionResult> {
    return this.buildSubmitTx(rawId, userAddress, amount, "deposit");
  }

  async withdraw(
    rawId: string,
    userAddress: string,
    amount: bigint
  ): Promise<TransactionResult> {
    return this.buildSubmitTx(rawId, userAddress, amount, "withdraw");
  }

  async borrow(
    rawId: string,
    userAddress: string,
    amount: bigint
  ): Promise<TransactionResult> {
    return this.buildSubmitTx(rawId, userAddress, amount, "borrow");
  }

  async repay(
    rawId: string,
    userAddress: string,
    amount: bigint
  ): Promise<TransactionResult> {
    return this.buildSubmitTx(rawId, userAddress, amount, "repay");
  }

  async supplyCollateral(
    rawId: string,
    userAddress: string,
    amount: bigint
  ): Promise<TransactionResult> {
    return this.buildSubmitTx(rawId, userAddress, amount, "supplyCollateral");
  }

  async withdrawCollateral(
    rawId: string,
    userAddress: string,
    amount: bigint
  ): Promise<TransactionResult> {
    return this.buildSubmitTx(rawId, userAddress, amount, "withdrawCollateral");
  }

  async claimRewards(
    rawId: string,
    userAddress: string
  ): Promise<TransactionResult> {
    const { poolContractId, assetAddress } = parseRawId(rawId);
    const network = getBlendNetwork();

    try {
      const pool = await PoolV2.load(network, poolContractId);
      const reserve = pool.reserves.get(assetAddress);

      if (!reserve) {
        throw new AdapterError(
          "blend",
          "claimRewards",
          `Reserve ${assetAddress} not found`
        );
      }

      const reserveTokenIds: number[] = [];
      if (reserve.supplyEmissions) {
        reserveTokenIds.push(reserve.getBTokenEmissionIndex());
      }
      if (reserve.borrowEmissions) {
        reserveTokenIds.push(reserve.getDTokenEmissionIndex());
      }

      if (reserveTokenIds.length === 0) {
        throw new UnsupportedActionError("blend", "claimRewards");
      }

      const poolContract = new PoolContractV2(poolContractId);
      const opXdr = poolContract.claim({
        from: userAddress,
        reserve_token_ids: reserveTokenIds,
        to: userAddress,
      });

      return this.wrapOperation(opXdr, userAddress);
    } catch (error) {
      if (
        error instanceof AdapterError ||
        error instanceof UnsupportedActionError
      ) {
        throw error;
      }
      throw new AdapterError("blend", "claimRewards", error);
    }
  }

  supportsAction(action: PoolAction): boolean {
    return SUPPORTED_ACTIONS.includes(action);
  }

  private async buildSubmitTx(
    rawId: string,
    userAddress: string,
    amount: bigint,
    action: string
  ): Promise<TransactionResult> {
    const { poolContractId, assetAddress } = parseRawId(rawId);
    const requestType = REQUEST_TYPE_MAP[action];

    if (requestType === undefined) {
      throw new UnsupportedActionError("blend", action);
    }

    try {
      const poolContract = new PoolContractV2(poolContractId);
      const request: Request = {
        request_type: requestType,
        address: assetAddress,
        amount,
      };

      const opXdr = poolContract.submit({
        from: userAddress,
        spender: userAddress,
        to: userAddress,
        requests: [request],
      });

      return this.wrapOperation(opXdr, userAddress);
    } catch (error) {
      throw new AdapterError("blend", action, error);
    }
  }

  private async wrapOperation(
    opXdrBase64: string,
    userAddress: string
  ): Promise<TransactionResult> {
    const operation = xdr.Operation.fromXDR(opXdrBase64, "base64");
    const horizon = new Horizon.Server(horizonUrl);
    const account = await horizon.loadAccount(userAddress);

    const tx = new TransactionBuilder(account, {
      fee: "100",
      networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(300)
      .build();

    const server = getSorobanServer(rpcUrl);
    const prepared = await server.prepareTransaction(tx);

    return {
      xdr: prepared.toXDR(),
      networkPassphrase,
    };
  }
}

function emptyPosition(poolId: string): PoolPosition {
  return {
    poolId,
    deposited: 0n,
    depositedFormatted: "0",
    supplied: 0n,
    suppliedFormatted: "0",
    collateral: 0n,
    collateralFormatted: "0",
    liabilities: 0n,
    liabilitiesFormatted: "0",
    rewards: 0n,
    rewardsFormatted: "0",
    limits: {},
    metadata: {},
  };
}

/**
 * Fraction of the user's remaining borrow headroom a Max button is allowed to
 * offer. Borrowing (or un-collateralizing) right up to the cap lands the
 * position at a health factor of exactly 1 — instantly liquidatable, and in
 * practice rejected at simulation because interest accrues between the moment
 * the position is read and the moment the transaction is submitted.
 */
const HEADROOM_SAFETY_MARGIN = 0.995;

/** Denominator used by Blend for fixed-point config values such as max_util. */
const FIXED_7 = 10_000_000n;

interface ReserveBalances {
  supplied: bigint;
  collateral: bigint;
  liabilities: bigint;
}

/**
 * Derive the maximum submittable amount for each action against one reserve.
 *
 * Every entry is bucket-aware: a Blend `submit` request moves exactly one
 * balance, so `withdraw` is bounded by the non-collateralized supply and
 * `withdrawCollateral` by the collateral — never by their sum.
 *
 * Capacity-derived ceilings (borrow, and the health bound on collateral
 * withdrawal) need oracle prices. When the oracle is unavailable the
 * balance- and liquidity-derived ceilings are still returned, so a price
 * outage degrades the caps rather than removing them.
 */
async function deriveLimits(
  pool: PoolV2,
  reserve: Reserve,
  poolUser: PoolUser,
  balances: ReserveBalances
): Promise<PoolActionLimits> {
  const decimals = reserve.config.decimals;
  const totalSupply = reserve.totalSupply();
  const totalLiabilities = reserve.totalLiabilities();

  // Cash actually sitting in the reserve — the pool cannot pay out more.
  const availableLiquidity = clampToZero(totalSupply - totalLiabilities);

  // Blend rejects any borrow that pushes the reserve past its max utilization.
  // A reserve missing the config falls back to full utilization rather than
  // throwing away the whole position read.
  const maxUtil = Number.isFinite(reserve.config.max_util)
    ? BigInt(Math.trunc(reserve.config.max_util))
    : FIXED_7;
  const borrowableLiquidity = clampToZero(
    (totalSupply * maxUtil) / FIXED_7 - totalLiabilities
  );

  const limits: PoolActionLimits = {
    withdraw: minBigInt(balances.supplied, availableLiquidity),
    withdrawCollateral: minBigInt(balances.collateral, availableLiquidity),
    repay: balances.liabilities,
    borrow: borrowableLiquidity,
  };

  let headroom: number | undefined;
  let price: number | undefined;
  try {
    const oracle = await pool.loadOracle();
    price = oracle.getPriceFloat(reserve.assetId);
    // borrowCap is effective collateral minus effective liabilities, in the
    // oracle's denomination — i.e. how much more effective debt fits.
    const estimate = PositionsEstimate.build(pool, oracle, poolUser.positions);
    headroom = Math.max(0, estimate.borrowCap) * HEADROOM_SAFETY_MARGIN;
  } catch {
    // No prices: keep the liquidity/balance ceilings derived above.
    return limits;
  }

  if (headroom === undefined || price === undefined || price <= 0) {
    return limits;
  }

  // Each asset unit borrowed adds `price / l_factor` of effective liability.
  const liabilityFactor = reserve.getLiabilityFactor();
  if (liabilityFactor > 0) {
    limits.borrow = minBigInt(
      borrowableLiquidity,
      assetsToSmallestUnits(headroom / (price * liabilityFactor), decimals)
    );
  }

  // Each collateral unit withdrawn removes `price * c_factor` of effective
  // collateral, so the same headroom bounds it. A reserve with no collateral
  // factor contributes no effective collateral and so is unconstrained here.
  const collateralFactor = reserve.getCollateralFactor();
  if (collateralFactor > 0) {
    limits.withdrawCollateral = minBigInt(
      limits.withdrawCollateral,
      assetsToSmallestUnits(headroom / (price * collateralFactor), decimals)
    );
  }

  return limits;
}

function clampToZero(value: bigint): bigint {
  return value > 0n ? value : 0n;
}

/**
 * Smallest of the defined operands. `undefined` means "no ceiling from this
 * source" and is skipped, so an unusable float never silently becomes a zero
 * cap that blocks the action.
 */
function minBigInt(...values: (bigint | undefined)[]): bigint | undefined {
  let min: bigint | undefined;
  for (const value of values) {
    if (value === undefined) continue;
    if (min === undefined || value < min) min = value;
  }
  return min;
}

/**
 * Floor a floating-point asset amount into smallest units.
 *
 * Returns undefined for values `toFixed` cannot render as plain decimal
 * (non-finite, or >= 1e21) so the caller falls back to another ceiling rather
 * than to a bogus number.
 */
function assetsToSmallestUnits(
  value: number,
  decimals: number
): bigint | undefined {
  if (!Number.isFinite(value) || value >= 1e21) return undefined;
  if (value <= 0) return 0n;

  // One extra digit then truncate, so the result floors instead of rounding up
  // past the cap it represents.
  const [intPart, fracPart = ""] = value.toFixed(decimals + 1).split(".");
  const digits = fracPart.slice(0, decimals).padEnd(decimals, "0");
  return BigInt(`${intPart}${digits}`);
}

function formatUnits(value: bigint, decimals: number): string {
  if (value === 0n) return "0";
  const str = value.toString().padStart(decimals + 1, "0");
  const intPart = str.slice(0, str.length - decimals) || "0";
  const fracPart = str.slice(str.length - decimals);
  const trimmed = fracPart.replace(/0+$/, "");
  return trimmed ? `${intPart}.${trimmed}` : intPart;
}
