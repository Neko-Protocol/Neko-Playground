import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Client as RwaLendingClient, networks } from "@neko/lending";
import {
  rpcUrl,
  networkPassphrase,
  allowHttpForSoroban,
} from "@/lib/constants/network";
import { fromSmallestUnit } from "@/lib/helpers/tokenUtils";
import { getAvailableTokens } from "@/lib/helpers/stellar/soroswap";
import { parseInterestRateFromContractResult } from "@/lib/helpers/lendingUtils";
import { RWA_TOKENS } from "@/lib/constants/wallet";
import type { BorrowPool } from "../types/borrowing";

/**
 * Hook to get all active borrow pools from the RWA lending contract
 * Only shows pools where:
 * - There's an RWA token configured as collateral
 * - There's a debt asset configured
 * - Pool has balance available to borrow
 */
export const useBorrowPools = () => {
  // Get available tokens (memoized to prevent re-computation on every render)
  const availableTokens = useMemo(() => getAvailableTokens(), []);

  // All RWA tokens configured as collateral (memoized)
  const rwaTokens = useMemo(
    () =>
      RWA_TOKENS.filter((code) => {
        const token = availableTokens[code];
        return token && token.contract;
      }),
    [availableTokens]
  );

  // Known debt assets that can be borrowed (memoized)
  const debtAssets = useMemo(
    () =>
      ["USDC", "XLM"].filter((code) => {
        const token = availableTokens[code];
        return token && token.contract;
      }),
    [availableTokens]
  );

  // Memoize the query function to prevent re-creation on every render
  const queryFn = useMemo(
    () => async (): Promise<BorrowPool[]> => {
      // Create RWA lending client with new contract ID
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

      const pools: BorrowPool[] = [];

      // For each combination of RWA collateral token and debt asset
      for (const rwaCode of rwaTokens) {
        const rwaToken = availableTokens[rwaCode];
        if (!rwaToken?.contract) continue;

        // Get collateral factor for this RWA token
        let collateralFactor = 0;
        try {
          const collateralFactorTx = await client.get_collateral_factor(
            { rwa_token: rwaToken.contract },
            { simulate: true }
          );
          const factorValue = collateralFactorTx.result;
          if (factorValue) {
            // Collateral factor is stored as basis points (e.g., 7500 = 75%)
            collateralFactor = Number(factorValue) / 100;
          }
        } catch {
          // If collateral factor fetch fails, skip this RWA token
          continue;
        }

        // Skip if collateral factor is 0 (not configured)
        if (collateralFactor === 0) continue;

        // For each debt asset, create a borrow pool
        for (const debtCode of debtAssets) {
          const debtToken = availableTokens[debtCode];
          if (!debtToken?.contract) continue;

          try {
            // Get pool balance for this debt asset
            const balanceTx = await client.get_pool_balance(
              { asset: debtCode },
              { simulate: true }
            );
            const balanceValue = balanceTx.result;
            // Only skip if balanceValue is undefined/null, NOT if it's 0
            if (balanceValue === undefined || balanceValue === null) continue;

            // Convert balance to human-readable format
            const decimals = debtToken.decimals || 7;
            // Handle different types: bigint, string, or number
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

            // Get interest rate for borrowing (basis points → percentage)
            let interestRate = 0;
            try {
              const interestRateTx = await client.get_interest_rate(
                { asset: debtCode },
                { simulate: true }
              );
              interestRate = parseInterestRateFromContractResult(
                interestRateTx.result
              );
            } catch {
              // If interest rate fetch fails, use 0
            }

            pools.push({
              asset: debtToken.contract,
              assetCode: debtCode,
              collateralToken: rwaToken.contract,
              collateralTokenCode: rwaCode,
              collateralFactor,
              interestRate,
              poolBalance,
              poolBalanceUSD: "Calculating...", // Will be calculated in component
              isActive: true,
            });
          } catch {
            // Skip assets that fail to fetch (not configured or error)
            continue;
          }
        }
      }

      return pools;
    },
    [rwaTokens, debtAssets, availableTokens]
  );

  return useQuery<BorrowPool[]>({
    queryKey: ["borrowPools"],
    queryFn,
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 10000, // Consider stale after 10 seconds
    retry: 2,
    throwOnError: false,
  });
};
