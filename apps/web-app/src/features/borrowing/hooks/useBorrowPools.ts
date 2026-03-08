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

export const useBorrowPools = () => {
  const availableTokens = useMemo(() => getAvailableTokens(), []);

  const rwaTokens = useMemo(
    () =>
      RWA_TOKENS.filter((code) => {
        const token = availableTokens[code];
        return token && token.contract;
      }),
    [availableTokens]
  );

  const debtAssets = useMemo(
    () =>
      ["USDC", "XLM"].filter((code) => {
        const token = availableTokens[code];
        return token && token.contract;
      }),
    [availableTokens]
  );

  const queryFn = useMemo(
    () => async (): Promise<BorrowPool[]> => {
      const contractId = networks.testnet.contractId;

      const client = new RwaLendingClient({
        contractId: contractId,
        rpcUrl: rpcUrl,
        networkPassphrase: networkPassphrase,
        ...(allowHttpForSoroban && { allowHttp: true }),
      });

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

      for (const rwaCode of rwaTokens) {
        const rwaToken = availableTokens[rwaCode];
        if (!rwaToken?.contract) continue;

        let collateralFactor = 0;
        try {
          const collateralFactorTx = await client.get_collateral_factor(
            { rwa_token: rwaToken.contract },
            { simulate: true }
          );
          const factorValue = collateralFactorTx.result;
          if (factorValue) {
            collateralFactor = Number(factorValue) / 100_000;
          }
        } catch {
          continue;
        }

        if (collateralFactor === 0) continue;

        for (const debtCode of debtAssets) {
          const debtToken = availableTokens[debtCode];
          if (!debtToken?.contract) continue;

          try {
            const balanceTx = await client.get_pool_balance(
              { asset: debtCode },
              { simulate: true }
            );
            const balanceValue = balanceTx.result;

            if (balanceValue === undefined || balanceValue === null) continue;

            const decimals = debtToken.decimals || 7;

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

            let interestRate = 0;
            try {
              const interestRateTx = await client.get_interest_rate(
                { asset: debtCode },
                { simulate: true }
              );
              interestRate = parseInterestRateFromContractResult(
                interestRateTx.result
              );
            } catch {}

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
    staleTime: 2 * 60_000, // 2 min: avoid refetch when re-entering tab
    gcTime: 10 * 60_000,
    refetchInterval: 2 * 60_000, // 2 min background refresh
    refetchOnWindowFocus: false, // don't refetch every time user switches to tab
    placeholderData: (prev) => prev,
    retry: 2,
    throwOnError: false,
  });
};
