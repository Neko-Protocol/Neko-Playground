import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Client as RwaLendingClient } from "@neko/lending";
import {
  rpcUrl,
  networkPassphrase,
  allowHttpForSoroban,
} from "@/lib/constants/network";
import { LENDING_CONTRACT_ID } from "@/lib/constants/contracts";
import { LENDING_DEBT_ASSETS } from "@/lib/constants/lending";
import { fromSmallestUnit } from "@/lib/helpers/tokenUtils";
import { getAvailableTokens } from "@/lib/helpers/stellar/soroswap";
import {
  parseInterestRateFromContractResult,
  stringifyValue,
} from "@/lib/helpers/lendingUtils";
import type { LendingPool } from "@/features/lending/types/lending";

/**
 * Hook to get all active lending pools from the RWA lending contract
 */
export const useLendingPools = () => {
  const availableTokens = useMemo(() => getAvailableTokens(), []);

  const debtAssets = useMemo(() => {
    return LENDING_DEBT_ASSETS.filter((code) => {
      const token = availableTokens[code];
      return token && token.contract;
    });
  }, [availableTokens]);

  const queryFn = useMemo(
    () => async (): Promise<LendingPool[]> => {
      const client = new RwaLendingClient({
        contractId: LENDING_CONTRACT_ID,
        rpcUrl,
        networkPassphrase,
        ...(allowHttpForSoroban && { allowHttp: true }),
      });

      let poolState;
      try {
        const poolStateTx = await client.get_pool_state({ simulate: true });
        poolState = poolStateTx.result;
      } catch (error) {
        console.warn("useLendingPools: get_pool_state failed", error);
        return [];
      }

      const isPoolActive = poolState?.tag === "Active";
      if (!isPoolActive) {
        return [];
      }

      const pools: LendingPool[] = [];

      for (const assetCode of debtAssets) {
        try {
          const token = availableTokens[assetCode];
          if (!token?.contract) {
            continue;
          }

          const balanceTx = await client.get_pool_balance(
            { asset: assetCode },
            { simulate: true }
          );
          const balanceValue = balanceTx.result;

          if (balanceValue === null || balanceValue === undefined) {
            continue;
          }

          const decimals = token.decimals || 7;
          const balanceStr = stringifyValue(balanceValue);
          const balanceBigInt = BigInt(balanceStr);
          const poolBalance = fromSmallestUnit(
            balanceBigInt.toString(),
            decimals
          );

          let interestRate = 0;
          try {
            const interestRateTx = await client.get_interest_rate(
              { asset: assetCode },
              { simulate: true }
            );
            interestRate = parseInterestRateFromContractResult(
              interestRateTx.result
            );
          } catch (error) {
            console.warn(
              "useLendingPools: get_interest_rate failed for",
              assetCode,
              error
            );
          }

          let bTokenRate = "1.0";
          try {
            const bTokenRateTx = await client.get_b_token_rate(
              { asset: assetCode },
              { simulate: true }
            );
            const bTokenRateValue = bTokenRateTx.result;
            if (bTokenRateValue) {
              const rateStr = stringifyValue(bTokenRateValue);
              bTokenRate = fromSmallestUnit(rateStr, 9);
            }
          } catch (error) {
            console.warn(
              "useLendingPools: get_b_token_rate failed for",
              assetCode,
              error
            );
          }

          pools.push({
            asset: token.contract,
            assetCode,
            poolBalance,
            interestRate,
            bTokenRate,
            isActive: true,
          });
        } catch (error) {
          console.warn(
            "useLendingPools: failed to load pool for",
            assetCode,
            error
          );
        }
      }

      return pools;
    },
    [debtAssets, availableTokens]
  );

  return useQuery<LendingPool[]>({
    queryKey: ["lendingPools"],
    queryFn,
    refetchInterval: 30000,
    staleTime: 10000,
    retry: 2,
    throwOnError: false,
  });
};
