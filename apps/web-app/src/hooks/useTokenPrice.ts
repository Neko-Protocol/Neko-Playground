import { useQuery } from "@tanstack/react-query";
import { getAvailableTokens, getTokenAddress } from "@/lib/helpers/soroswap";
import type { Token } from "@/lib/helpers/soroswap";
import oracleClient from "@/lib/clients/oracle";

/**
 * RWA token codes that should use the oracle
 */
const RWA_TOKENS = ["NVDA", "AAPL", "PLTR", "TSLA", "META"];

/**
 * Map token codes to CoinGecko IDs (for non-RWA tokens)
 */
const TOKEN_PRICE_MAP: Record<string, string> = {
  XLM: "stellar",
  USDC: "usd-coin",
};

/**
 * Get token price from RWA Oracle
 */
const fetchRWAOraclePrice = async (tokenContract: string): Promise<number> => {
  try {
    // Call lastprice with the token contract as an asset
    // Asset type in Rust: Asset::Stellar(Address) | Asset::Other(Symbol)
    // In TypeScript: {tag: "Stellar", values: readonly [string]} | {tag: "Other", values: readonly [string]}
    // For Soroban contract addresses, we use "Stellar" tag
    // The contract expects Asset::Stellar(Address) for Soroban contracts
    // According to the contract: "Can be a Stellar Classic or Soroban asset"
    const asset: { tag: "Stellar"; values: readonly [string] } = {
      tag: "Stellar",
      values: [tokenContract] as readonly [string],
    };
    console.log("Calling oracle lastprice for asset:", asset);
    const result = await oracleClient.lastprice({ asset }, { simulate: true });
    console.log("Oracle lastprice result:", result);

    // Extract price from result
    // result.result is Option<PriceData>, which is {tag: "Some", values: PriceData} or {tag: "None", values: void}
    const optionResult = result.result as unknown as
      | {
          tag: "Some";
          values: {
            price: bigint | string | number;
            timestamp: bigint | string | number;
          };
        }
      | { tag: "None"; values: void };

    if (optionResult.tag === "Some") {
      const priceData = optionResult.values;
      console.log("Oracle price data received:", {
        price: priceData.price,
        timestamp: priceData.timestamp,
        priceType: typeof priceData.price,
        timestampType: typeof priceData.timestamp,
      });

      // Validate timestamp - if it's in the future, use current time
      let validTimestamp = Number(priceData.timestamp);
      const now = Math.floor(Date.now() / 1000);

      if (validTimestamp > now) {
        console.warn(
          `Oracle returned future timestamp ${validTimestamp}, using current time ${now}`
        );
        validTimestamp = now;
      }
      // Price is in i128, need to convert to number
      // The oracle stores price with decimals, typically 7 decimals
      const priceValue = BigInt(priceData.price.toString());
      const decimals = 7; // Oracle decimals
      const price = Number(priceValue) / Math.pow(10, decimals);

      // Use validated timestamp
      const timestamp = validTimestamp;
      return price;
    }

    return 0;
  } catch (error) {
    console.error(
      `Failed to fetch RWA oracle price for ${tokenContract}:`,
      error
    );
    return 0;
  }
};

/**
 * Sleep utility for retry delays
 */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Get token price in USD from CoinGecko API (for non-RWA tokens)
 */
const fetchTokenPrice = async (
  tokenCode: string,
  retryCount = 0
): Promise<number> => {
  // Validate input
  if (!tokenCode || typeof tokenCode !== "string") {
    console.error(
      `Invalid tokenCode provided to fetchTokenPrice:`,
      tokenCode,
      typeof tokenCode
    );
    return 0;
  }

  const coinGeckoId = TOKEN_PRICE_MAP[tokenCode];
  const MAX_RETRIES = 3;
  const BASE_DELAY = 1000; // 1 second

  if (!coinGeckoId) {
    // If token not in map, return default prices for known tokens
    if (tokenCode === "USDC") {
      return 1.0;
    }
    if (tokenCode === "XLM") {
      return 0.1;
    }
    console.warn(`No CoinGecko ID mapping found for token: ${tokenCode}`);
    return 0;
  }

  try {
    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinGeckoId}&vs_currencies=usd`,
      {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "User-Agent": "Neko-DApp/1.0",
        },
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as {
      [key: string]: { usd?: number } | undefined;
    };

    const price = data[coinGeckoId]?.usd;
    if (price === undefined || price === null) {
      throw new Error(`Price data not found in response for ${coinGeckoId}`);
    }

    return price;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.warn(
      `Failed to fetch price for ${tokenCode} (attempt ${retryCount + 1}):`,
      errorMessage
    );

    // Check if we should retry
    const shouldRetry =
      retryCount < MAX_RETRIES &&
      // Retry on network errors
      (errorMessage.includes("Failed to fetch") ||
        errorMessage.includes("NetworkError") ||
        errorMessage.includes("AbortError") ||
        // Retry on rate limiting
        errorMessage.includes("429") ||
        // Retry on server errors
        errorMessage.includes("500") ||
        errorMessage.includes("502") ||
        errorMessage.includes("503") ||
        errorMessage.includes("504"));

    if (shouldRetry) {
      const delay = BASE_DELAY * Math.pow(2, retryCount); // Exponential backoff
      await sleep(delay);
      return fetchTokenPrice(tokenCode, retryCount + 1);
    }

    // Return fallback prices for known tokens
    if (tokenCode === "USDC") {
      console.log(`Using fallback price for ${tokenCode}: $1.0`);
      return 1.0;
    }
    if (tokenCode === "XLM") {
      console.log(`Using fallback price for ${tokenCode}: $0.1`);
      return 0.1;
    }

    console.error(`All retries exhausted for ${tokenCode}, returning 0`);
    return 0;
  }
};

/**
 * Hook to get token price in USD
 */
export const useTokenPrice = (token: Token | string | undefined) => {
  // Get token code from token address
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

      // If token is a string, it might already be a token code
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
  } = useQuery<number, Error>({
    queryKey: ["tokenPrice", tokenCode, token],
    queryFn: async () => {
      if (!tokenCode || typeof tokenCode !== "string") {
        console.warn(
          `Invalid tokenCode in useTokenPrice:`,
          tokenCode,
          typeof tokenCode
        );
        return 0;
      }

      // Check if token is RWA
      const isRWA = RWA_TOKENS.includes(tokenCode);

      if (isRWA) {
        // Get price from RWA Oracle
        const tokenAddress = getTokenAddress(token!);
        return await fetchRWAOraclePrice(tokenAddress);
      } else {
        // Get price from CoinGecko for USDC and XLM
        return await fetchTokenPrice(tokenCode);
      }
    },
    enabled: Boolean(tokenCode && token),
    refetchInterval: 60000, // Refetch every minute
    staleTime: 30000, // Consider stale after 30 seconds
    retry: 2,
    throwOnError: false,
  });

  return {
    price,
    isLoading,
    error: error ? error.message : null,
  };
};
