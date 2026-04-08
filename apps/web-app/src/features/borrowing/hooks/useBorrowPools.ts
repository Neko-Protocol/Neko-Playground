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

/** Debt assets borrowable from Pool 2 (collateral = USDC/XLM) */
const POOL2_DEBT_ASSETS = [
  "USTRY",
  "TESOURO",
  "CETES",
  "USDY",
  "PYUSD",
  "KTB",
];
/** Collateral assets accepted by Pool 2 */
const POOL2_COLLATERAL_ASSETS = ["USDC", "XLM"];

async function fetchPoolPools(
  client: RwaLendingClient,
  contractId: string,
  collateralCodes: string[],
  debtCodes: string[],
  availableTokens: ReturnType<typeof getAvailableTokens>
): Promise<BorrowPool[]> {
  let poolState;
  try {
    const poolStateTx = await client.get_pool_state({ simulate: true });
    poolState = poolStateTx.result;
  } catch {
    return [];
  }

  if (poolState?.tag !== "Active") return [];

  const pools: BorrowPool[] = [];

  for (const collateralCode of collateralCodes) {
    const collateralToken = availableTokens[collateralCode];
    if (!collateralToken?.contract) continue;

    let collateralFactor = 0;
    try {
      const factorTx = await client.get_collateral_factor(
        { neko_token: collateralToken.contract },
        { simulate: true }
      );
      const factorValue = factorTx.result;
      if (factorValue) {
        collateralFactor = Number(factorValue) / 100_000;
      }
    } catch {
      continue;
    }

    if (collateralFactor === 0) continue;

    for (const debtCode of debtCodes) {
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
        const poolBalance = fromSmallestUnit(
          BigInt(balanceStr).toString(),
          decimals
        );

        let interestRate = 0;
        try {
          const rateTx = await client.get_interest_rate(
            { asset: debtCode },
            { simulate: true }
          );
          interestRate = parseInterestRateFromContractResult(rateTx.result);
        } catch {
          // use 0
        }

        pools.push({
          asset: debtToken.contract,
          assetCode: debtCode,
          collateralToken: collateralToken.contract,
          collateralTokenCode: collateralCode,
          collateralFactor,
          interestRate,
          poolBalance,
          poolBalanceUSD: "Calculating...",
          isActive: true,
          contractId,
        });
      } catch {
        continue;
      }
    }
  }

  return pools;
}

export const useBorrowPools = () => {
  const availableTokens = useMemo(() => getAvailableTokens(), []);

  const pool1CollateralCodes = useMemo(
    () => RWA_TOKENS.filter((c) => availableTokens[c]?.contract),
    [availableTokens]
  );

  const pool1DebtCodes = useMemo(
    () => ["USDC", "XLM"].filter((c) => availableTokens[c]?.contract),
    [availableTokens]
  );

  const pool2CollateralCodes = useMemo(
    () => POOL2_COLLATERAL_ASSETS.filter((c) => availableTokens[c]?.contract),
    [availableTokens]
  );

  const pool2DebtCodes = useMemo(
    () => POOL2_DEBT_ASSETS.filter((c) => availableTokens[c]?.contract),
    [availableTokens]
  );

  const queryFn = useMemo(
    () => async (): Promise<BorrowPool[]> => {
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
        fetchPoolPools(
          pool1Client,
          networks.testnet.pool1ContractId,
          pool1CollateralCodes,
          pool1DebtCodes,
          availableTokens
        ),
        fetchPoolPools(
          pool2Client,
          networks.testnet.pool2ContractId,
          pool2CollateralCodes,
          pool2DebtCodes,
          availableTokens
        ),
      ]);

      return [...pool1Pools, ...pool2Pools];
    },
    [
      pool1CollateralCodes,
      pool1DebtCodes,
      pool2CollateralCodes,
      pool2DebtCodes,
      availableTokens,
    ]
  );

  return useQuery<BorrowPool[]>({
    queryKey: ["borrowPools"],
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
