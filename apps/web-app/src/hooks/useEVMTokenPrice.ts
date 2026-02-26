import { useQuery } from "@tanstack/react-query";
import type { EVMToken } from "@/lib/types/evmToken";
import { EVM_TOKENS } from "@/lib/constants/evmConfig";
import { priceService } from "@/lib/services";

export const useEVMTokenPrice = (
  token: EVMToken | string | undefined
): { price: number; isLoading: boolean; error: string | null } => {
  const getTokenSymbol = (): string | null => {
    if (!token) return null;

    if (typeof token === "string") {
      return (
        Object.keys(EVM_TOKENS).find(
          (key) => key === token || EVM_TOKENS[key].symbol === token
        ) || null
      );
    }

    if ("symbol" in token && "chainId" in token) {
      return token.symbol || null;
    }

    return null;
  };

  const tokenSymbol = getTokenSymbol();

  const {
    data: priceResult,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["evmTokenPrice", tokenSymbol, token],
    queryFn: async () => {
      if (!tokenSymbol) {
        return { price: 0, source: "invalid" };
      }
      return await priceService.getTokenPrice(tokenSymbol, {
        enableFallbacks: true,
        timeout: 5000,
      });
    },
    enabled: Boolean(tokenSymbol && token),
    refetchInterval: 60000,
    staleTime: 30000,
    retry: 2,
    throwOnError: false,
  });

  return {
    price: priceResult?.price || 0,
    isLoading,
    error: error ? error.message : null,
  };
};
