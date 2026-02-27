import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Client as RwaLendingClient, networks } from "@neko/lending";
import { rpcUrl, networkPassphrase } from "@/lib/constants/network";
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

  // Memoize debt assets list
  const debtAssets = useMemo(() => {
    return ["USDC", "XLM"].filter((code) => {
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
              bTokenRate = fromSmallestUnit(rateBigInt.toString(), 9);
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
    refetchInterval: 30000,
    staleTime: 10000,
    retry: 2,
    throwOnError: false,
  });
};
