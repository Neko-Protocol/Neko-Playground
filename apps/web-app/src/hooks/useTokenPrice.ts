import { useQuery } from "@tanstack/react-query";
import {
  getAvailableTokens,
  getTokenAddress,
} from "@/lib/helpers/stellar/soroswap";
import type { Token } from "@/lib/helpers/stellar/soroswap";
import { stellarPriceService } from "@/lib/services/stellar-price.service";

/**
 * Hook to get token price in USD
 */
export const useTokenPrice = (token: Token | string | undefined) => {
  const getTokenCode = (): string | null => {
    if (!token) {
      return null;
    }

    try {
      const tokenAddress = getTokenAddress(token);
      const availableTokens = getAvailableTokens();

      for (const [code, info] of Object.entries(availableTokens)) {
        if (info.contract === tokenAddress) {
          return code;
        }
      }

      if (typeof token === "string") {
        return token;
      }

      return null;
    } catch (error) {
      console.error("Error in getTokenCode:", error);
      return null;
    }
  };

  const tokenCode = getTokenCode();

  const {
    data: price = 0,
    isLoading,
    error,
    isFetched,
  } = useQuery<number, Error>({
    queryKey: ["tokenPrice", tokenCode, token],
    queryFn: async () => {
      if (!tokenCode || typeof tokenCode !== "string") {
        return 0;
      }

      if (stellarPriceService.isRWAToken(tokenCode)) {
        const tokenAddress = getTokenAddress(token!);
        return stellarPriceService.getRWAOraclePrice(tokenAddress);
      }

      return stellarPriceService.getTokenPrice(tokenCode);
    },
    enabled: Boolean(tokenCode && token),
    refetchInterval: 60000,
    staleTime: 30000,
    retry: 2,
    throwOnError: false,
  });

  const priceError =
    error?.message ?? (isFetched && price === 0 ? "Price unavailable" : null);

  return {
    price,
    isLoading,
    error: priceError,
  };
};
