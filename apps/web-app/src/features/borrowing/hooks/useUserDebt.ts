import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@/hooks/useWallet";
import { getDTokenBalance, getDTokenRate } from "@/lib/helpers/stellar/lending";

const SCALAR_12 = 1_000_000_000_000n;
const STELLAR_DECIMALS = 7;

interface UserDebt {
  dTokens: bigint;
  dRate: bigint;
  debtRaw: bigint;
  debtFormatted: string;
}

async function fetchUserDebt(
  assetCode: string,
  walletAddress: string
): Promise<UserDebt> {
  const [dTokens, dRate] = await Promise.all([
    getDTokenBalance(assetCode, walletAddress),
    getDTokenRate(assetCode),
  ]);

  const debtRaw = dRate > 0n ? (dTokens * dRate) / SCALAR_12 : 0n;
  const debtFormatted =
    debtRaw === 0n
      ? "0"
      : (Number(debtRaw) / 10 ** STELLAR_DECIMALS).toFixed(STELLAR_DECIMALS);

  return { dTokens, dRate, debtRaw, debtFormatted };
}

export function useUserDebt(assetCode: string | undefined) {
  const { address } = useWallet();

  return useQuery<UserDebt>({
    queryKey: ["userDebt", assetCode, address],
    queryFn: () => fetchUserDebt(assetCode!, address!),
    enabled: Boolean(assetCode && address),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    retry: 1,
  });
}
