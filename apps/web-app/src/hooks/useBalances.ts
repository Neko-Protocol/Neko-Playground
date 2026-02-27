import { useQuery } from "@tanstack/react-query";
import {
  fetchBalances,
  type MappedBalances,
} from "@/lib/helpers/stellar/wallet";

/**
 * Hook to fetch wallet balances using React Query.
 * Provides intelligent polling, caching, and error handling.
 *
 * @param address - The Stellar wallet address to fetch balances for
 * @param options - Configuration options for the query
 * @returns React Query result with balances data
 */
export const useBalances = (
  address: string | undefined,
  options?: {
    /**
     * Enable or disable the query (useful when address is not available)
     */
    enabled?: boolean;
    /**
     * Polling interval in milliseconds. Set to 0 to disable polling.
     * Default: 10000 (10 seconds)
     */
    refetchInterval?: number;
    /**
     * Whether to refetch when window regains focus
     * Default: false (to avoid excessive requests)
     */
    refetchOnWindowFocus?: boolean;
    /**
     * Whether to keep previous data while fetching new data
     * Default: true (to prevent flickering)
     */
    keepPreviousData?: boolean;
    /**
     * Number of retry attempts on error
     * Default: 2
     */
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
      return await fetchBalances(address);
    },
    enabled: enabled && Boolean(address),
    refetchInterval: refetchInterval > 0 ? refetchInterval : false,
    refetchOnWindowFocus,
    // React Query v5: Use placeholderData to keep previous data while fetching new data
    // This prevents flickering when data is being refetched
    placeholderData: keepPreviousData
      ? (previousData) => previousData ?? ({} as MappedBalances)
      : undefined,
    retry: (failureCount, error) => {
      // Don't retry if we've exceeded the retry limit
      if (failureCount >= retry) {
        return false;
      }
      // Don't retry on "not found" errors (expected for unfunded accounts)
      if (error instanceof Error && error.message.match(/not found/i)) {
        return false;
      }
      // Retry on other errors
      return true;
    },
    retryOnMount: true,
    staleTime: 5000, // Consider data stale after 5 seconds
    gcTime: 60000, // Keep unused data in cache for 60 seconds
    // Don't throw on errors - we handle them gracefully
    throwOnError: false,
  });
};
