import { useQuery } from "@tanstack/react-query";
import {
  getAvailableTokens,
  getTokenAddress,
} from "@/lib/helpers/stellar/soroswap";
import type { Token } from "@/lib/helpers/stellar/soroswap";
import { stellarPriceService } from "@/lib/services/stellar-price.service";

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

      const contractAddress = getTokenAddress(token!);
      return stellarPriceService.getPrice(tokenCode, contractAddress);
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
