import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Client as RwaLendingClient, networks } from "@neko/lending";
import {
  rpcUrl,
  networkPassphrase,
  allowHttpForSoroban,
} from "@/lib/constants/network";
import { fromSmallestUnit } from "@/lib/helpers/tokenUtils";
import { getAvailableTokens } from "@/lib/helpers/stellar/soroswap";
import { parseInterestRateFromContractResult } from "@/lib/helpers/lendingUtils";

export interface LendingPool {
  asset: string;
  assetCode: string;
  poolBalance: string;
  poolBalanceUSD: string;
  interestRate: number;
  bTokenRate: string;
  isActive: boolean;
  contractId: string;
}

/** Deposit assets for each pool */
const POOL1_ASSETS = ["USDC", "XLM"];
const POOL2_ASSETS = ["USTRY", "TESOURO", "CETES", "USDY", "PYUSD"];

async function fetchLendingPools(
  client: RwaLendingClient,
  contractId: string,
  assetCodes: string[],
  availableTokens: ReturnType<typeof getAvailableTokens>
): Promise<LendingPool[]> {
  let poolState;
  try {
    const poolStateTx = await client.get_pool_state({ simulate: true });
    poolState = poolStateTx.result;
  } catch {
    return [];
  }

  if (poolState?.tag !== "Active") return [];

  const pools: LendingPool[] = [];

  for (const assetCode of assetCodes) {
    try {
      const token = availableTokens[assetCode];
      if (!token?.contract) continue;

      const balanceTx = await client.get_pool_balance(
        { asset: assetCode },
        { simulate: true }
      );
      const balanceValue = balanceTx.result;
      if (balanceValue === null || balanceValue === undefined) continue;

      const decimals = token.decimals || 7;
      const balanceStr =
        typeof balanceValue === "bigint"
          ? balanceValue.toString()
          : typeof balanceValue === "string"
            ? balanceValue
            : String(balanceValue);
      const poolBalance = fromSmallestUnit(
        BigInt(balanceStr).toString(),
        decimals
      );

      let interestRate = 0;
      try {
        const rateTx = await client.get_interest_rate(
          { asset: assetCode },
          { simulate: true }
        );
        interestRate = parseInterestRateFromContractResult(rateTx.result);
      } catch {
        // use 0
      }

      let bTokenRate = "1.0";
      try {
        const bRateTx = await client.get_b_token_rate(
          { asset: assetCode },
          { simulate: true }
        );
        const bRateValue = bRateTx.result;
        if (bRateValue) {
          bTokenRate = fromSmallestUnit(
            BigInt(bRateValue.toString()).toString(),
            12
          );
        }
      } catch {
        // use 1.0
      }

      pools.push({
        asset: token.contract,
        assetCode,
        poolBalance,
        poolBalanceUSD: "Calculating...",
        interestRate,
        bTokenRate,
        isActive: true,
        contractId,
      });
    } catch {
      continue;
    }
  }

  return pools;
}

export const useLendingPools = () => {
  const availableTokens = useMemo(() => getAvailableTokens(), []);

  const queryFn = useMemo(
    () => async (): Promise<LendingPool[]> => {
      const clientOptions = {
        rpcUrl,
        networkPassphrase,
        ...(allowHttpForSoroban && { allowHttp: true }),
      };

      const pool1Client = new RwaLendingClient({
        contractId: networks.testnet.pool1ContractId,
        ...clientOptions,
      });
      const pool2Client = new RwaLendingClient({
        contractId: networks.testnet.pool2ContractId,
        ...clientOptions,
      });

      const [pool1Pools, pool2Pools] = await Promise.all([
        fetchLendingPools(
          pool1Client,
          networks.testnet.pool1ContractId,
          POOL1_ASSETS,
          availableTokens
        ),
        fetchLendingPools(
          pool2Client,
          networks.testnet.pool2ContractId,
          POOL2_ASSETS,
          availableTokens
        ),
      ]);

      return [...pool1Pools, ...pool2Pools];
    },
    [availableTokens]
  );

  return useQuery<LendingPool[]>({
    queryKey: ["lendingPools"],
    queryFn,
    staleTime: 2 * 60_000,
    gcTime: 10 * 60_000,
    refetchInterval: 2 * 60_000,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev,
    retry: 2,
    throwOnError: false,
  });
};
