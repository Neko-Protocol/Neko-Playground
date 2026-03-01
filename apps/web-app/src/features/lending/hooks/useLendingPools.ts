import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Client as RwaLendingClient, networks } from "@neko/lending";
import {
  rpcUrl,
  networkPassphrase,
  allowHttpForSoroban,
} from "@/lib/constants/network";
import { fromSmallestUnit, stringifyValue } from "@/lib/helpers/tokenUtils";
import { getAvailableTokens } from "@/lib/helpers/stellar/soroswap";
import { parseInterestRateFromContractResult } from "@/lib/helpers/lendingUtils";
import { LENDING_ASSETS, BTOKEN_DECIMALS } from "../constants";
import type { LendingPool } from "../types/lending";

/**
 * Hook to get all active lending pools from the RWA lending contract
 */
export const useLendingPools = () => {
  const availableTokens = useMemo(() => getAvailableTokens(), []);

  const debtAssets = useMemo(() => {
    return LENDING_ASSETS.filter((code) => {
      const token = availableTokens[code];
      return token && token.contract;
    });
  }, [availableTokens]);

  const queryFn = useMemo(
    () => async () => {
      const client = new RwaLendingClient({
        contractId: networks.testnet.contractId,
        rpcUrl,
        networkPassphrase,
        ...(allowHttpForSoroban && { allowHttp: true }),
      });

      let poolState;
      try {
        const poolStateTx = await client.get_pool_state({ simulate: true });
        poolState = poolStateTx.result;
      } catch (err) {
        console.warn("useLendingPools: failed to fetch pool state", err);
        return [];
      }

      if (poolState?.tag !== "Active") {
        return [];
      }

      const pools: LendingPool[] = [];

      for (const assetCode of debtAssets) {
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
          const balanceBigInt = BigInt(stringifyValue(balanceValue));
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
          } catch (err) {
            console.warn(
              `useLendingPools: failed to fetch interest rate for ${assetCode}`,
              err
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
              const rateBigInt = BigInt(bTokenRateValue.toString());
              bTokenRate = fromSmallestUnit(
                rateBigInt.toString(),
                BTOKEN_DECIMALS
              );
            }
          } catch (err) {
            console.warn(
              `useLendingPools: failed to fetch bToken rate for ${assetCode}`,
              err
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
        } catch (err) {
          console.warn(
            `useLendingPools: failed to fetch pool data for ${assetCode}`,
            err
          );
          continue;
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
