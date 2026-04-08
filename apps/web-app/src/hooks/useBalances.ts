import { useQuery } from "@tanstack/react-query";
import {
  fetchBalances,
  type MappedBalances,
} from "@/lib/helpers/stellar/wallet";

export const useBalances = (
  address: string | undefined,
  options?: {
    enabled?: boolean;

    refetchInterval?: number;

    refetchOnWindowFocus?: boolean;

    keepPreviousData?: boolean;

    retry?: number;
  }
) => {
  const {
    enabled = true,
    refetchInterval = 10000, // 10 seconds default polling
    refetchOnWindowFocus = false,
    keepPreviousData = true,
    retry = 2,
  } = options ?? {};

  return useQuery<MappedBalances, Error>({
    queryKey: ["balances", address],
    queryFn: async () => {
      if (!address) {
        return {};
      }
      const { balances } = await fetchBalances(address);
      return balances;
    },
    enabled: enabled && Boolean(address),
    refetchInterval: refetchInterval > 0 ? refetchInterval : false,
    refetchOnWindowFocus,

    placeholderData: keepPreviousData
      ? (previousData) => previousData ?? ({} as MappedBalances)
      : undefined,
    retry: (failureCount, error) => {
      if (failureCount >= retry) {
        return false;
      }

      if (error instanceof Error && error.message.match(/not found/i)) {
        return false;
      }

      return true;
    },
    retryOnMount: true,
    staleTime: 5000, // Consider data stale after 5 seconds
    gcTime: 60000, // Keep unused data in cache for 60 seconds

    throwOnError: false,
  });
};
