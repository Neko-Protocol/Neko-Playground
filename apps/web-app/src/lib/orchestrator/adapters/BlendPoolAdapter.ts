import {
  PoolV2,
  PoolContractV2,
  RequestType,
  TokenMetadata,
  type Request,
} from "@blend-capital/blend-sdk";
import { TransactionBuilder, rpc, xdr, Horizon } from "@stellar/stellar-sdk";

import { rpcUrl, networkPassphrase, horizonUrl } from "@/lib/constants/network";

import type { BasePoolAdapter } from "../types/adapter.types";
import type {
  PoolAction,
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

      const deposited = supplied + collateral;

      return {
        poolId: fullId,
        deposited,
        depositedFormatted: formatUnits(deposited, decimals),
        rewards: 0n,
        rewardsFormatted: "0",
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

    const server = new rpc.Server(rpcUrl, { allowHttp: true });
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
    rewards: 0n,
    rewardsFormatted: "0",
    metadata: {},
  };
}

function formatUnits(value: bigint, decimals: number): string {
  if (value === 0n) return "0";
  const str = value.toString().padStart(decimals + 1, "0");
  const intPart = str.slice(0, str.length - decimals) || "0";
  const fracPart = str.slice(str.length - decimals);
  const trimmed = fracPart.replace(/0+$/, "");
  return trimmed ? `${intPart}.${trimmed}` : intPart;
}
