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

interface LendingPool {
  asset: string;
  assetCode: string;
  poolBalance: string;
  poolBalanceUSD: string;
  interestRate: number;
  bTokenRate: string;
  isActive: boolean;
}

/**
 * Hook to get all active lending pools from the RWA lending contract
 */
export const useLendingPools = () => {
  // Memoize available tokens to prevent unnecessary re-renders
  const availableTokens = useMemo(() => getAvailableTokens(), []);

  // All available tokens are potential debt assets — filter to those with a contract
  const debtAssets = useMemo(() => {
    return Object.keys(availableTokens).filter((code) => {
      const token = availableTokens[code];
      return token && token.contract;
    });
  }, [availableTokens]);

  // Memoize the query function to prevent recreating it on every render
  const queryFn = useMemo(
    () => async () => {
      const contractId = networks.testnet.contractId;

      const client = new RwaLendingClient({
        contractId: contractId,
        rpcUrl: rpcUrl,
        networkPassphrase: networkPassphrase,
        ...(allowHttpForSoroban && { allowHttp: true }),
      });

      // Get pool state
      let poolState;
      try {
        const poolStateTx = await client.get_pool_state({ simulate: true });
        poolState = poolStateTx.result;
      } catch {
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
          const balanceStr =
            typeof balanceValue === "bigint"
              ? balanceValue.toString()
              : typeof balanceValue === "string"
                ? balanceValue
                : String(balanceValue);
          const balanceBigInt = BigInt(balanceStr);
          const poolBalance = fromSmallestUnit(
            balanceBigInt.toString(),
            decimals
          );

          // Get interest rate (basis points → percentage)
          let interestRate = 0;
          try {
            const interestRateTx = await client.get_interest_rate(
              { asset: assetCode },
              { simulate: true }
            );
            interestRate = parseInterestRateFromContractResult(
              interestRateTx.result
            );
          } catch {
            // If interest rate fetch fails, use 0
          }

          // Get bToken rate
          let bTokenRate = "1.0";
          try {
            const bTokenRateTx = await client.get_b_token_rate(
              { asset: assetCode },
              { simulate: true }
            );
            const bTokenRateValue = bTokenRateTx.result;
            if (bTokenRateValue) {
              const rateBigInt = BigInt(bTokenRateValue.toString());
              // b_rate uses 12 decimals (SCALAR_12 = 1_000_000_000_000), initial 1:1 rate
              bTokenRate = fromSmallestUnit(rateBigInt.toString(), 12);
            }
          } catch {
            // If bToken rate fetch fails, use 1.0
          }

          pools.push({
            asset: token.contract,
            assetCode,
            poolBalance,
            poolBalanceUSD: "Calculating...",
            interestRate,
            bTokenRate,
            isActive: true,
          });
        } catch {
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
    staleTime: 2 * 60_000, // 2 min: avoid refetch when re-entering tab
    gcTime: 10 * 60_000,
    refetchInterval: 2 * 60_000, // 2 min background refresh
    refetchOnWindowFocus: false, // don't refetch every time user switches to tab
    placeholderData: (prev) => prev,
    retry: 2,
    throwOnError: false,
  });
};
