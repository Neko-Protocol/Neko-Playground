/**
 * Price Service
 * Handles token price fetching from various sources (CoinGecko, etc.)
 */

import { PRICE_ERROR_DELAY_MS } from "@/lib/constants/wallet";
import type { TokenPriceResult, PriceFetchOptions } from "../types/priceTypes";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class PriceService {
  private priceCache = new Map<string, TokenPriceResult>();
  private readonly CACHE_DURATION = 30000; // 30 seconds
  private readonly REQUEST_TIMEOUT = 5000; // 5 seconds

  // CoinGecko ID mapping for tokens with public market prices.
  // RWA tokens (USTRY, TESOURO, CETES) use the oracle contract for pricing.
  private readonly COINGECKO_ID_MAP: Record<string, string> = {
    XLM: "stellar",
    USDC: "usd-coin",
    USDY: "ondo-us-dollar-yield",
    PYUSD: "paypal-usd",
  };

  /**
   * Check if cached price is still valid
   */
  private isPriceValid(cached: TokenPriceResult): boolean {
    if (!cached.lastUpdated) return false;
    const now = new Date();
    const age = now.getTime() - cached.lastUpdated.getTime();
    return age < this.CACHE_DURATION;
  }

  /**
   * Fetch price from CoinGecko API
   */
  private async fetchFromCoinGecko(
    coinGeckoId: string,
    timeout: number = this.REQUEST_TIMEOUT
  ): Promise<number> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const url = `/api/coingecko/price?ids=${coinGeckoId}&vs_currencies=usd`;

      const response = await fetch(url, {
        method: "GET",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error("RATE_LIMIT_EXCEEDED");
        }

        throw new Error(
          `Failed to fetch price: ${response.status} ${response.statusText}`
        );
      }

      const data = (await response.json()) as {
        [key: string]: { usd?: number } | undefined;
      };

      const price = data[coinGeckoId]?.usd || 0;
      return price;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("PRICE_FETCH_TIMEOUT");
      }

      throw error;
    }
  }

  /**
   * Get CoinGecko ID for token symbol
   */
  private getCoinGeckoId(tokenSymbol: string): string | null {
    return this.COINGECKO_ID_MAP[tokenSymbol] || null;
  }

  /**
   * Fetch token price with caching and fallbacks
   */
  async getTokenPrice(
    tokenSymbol: string,
    options: PriceFetchOptions = {}
  ): Promise<TokenPriceResult> {
    const { forceRefresh = false, timeout = this.REQUEST_TIMEOUT } = options;

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = this.priceCache.get(tokenSymbol);
      if (cached && this.isPriceValid(cached)) {
        return cached;
      }
    }

    const coinGeckoId = this.getCoinGeckoId(tokenSymbol);

    if (!coinGeckoId) {
      await sleep(PRICE_ERROR_DELAY_MS);
      const result: TokenPriceResult = {
        price: 0,
        source: "unavailable",
        lastUpdated: new Date(),
      };
      this.priceCache.set(tokenSymbol, result);
      return result;
    }

    try {
      const price = await this.fetchFromCoinGecko(coinGeckoId, timeout);
      const result: TokenPriceResult = {
        price,
        source: "coingecko",
        lastUpdated: new Date(),
      };
      this.priceCache.set(tokenSymbol, result);
      return result;
    } catch (error) {
      console.warn(`Failed to fetch price for ${tokenSymbol}:`, error);

      await sleep(PRICE_ERROR_DELAY_MS);
      const result: TokenPriceResult = {
        price: 0,
        source: "error",
        lastUpdated: new Date(),
      };
      this.priceCache.set(tokenSymbol, result);
      return result;
    }
  }

  /**
   * Get multiple token prices in batch
   */
  async getTokenPrices(
    tokenSymbols: string[],
    options: PriceFetchOptions = {}
  ): Promise<Record<string, TokenPriceResult>> {
    const results: Record<string, TokenPriceResult> = {};

    // Use Promise.allSettled to handle partial failures
    const promises = tokenSymbols.map(async (symbol) => {
      try {
        const price = await this.getTokenPrice(symbol, options);
        return { symbol, price };
      } catch (error) {
        console.warn(`Failed to get price for ${symbol}:`, error);
        return {
          symbol,
          price: {
            price: 0,
            source: "error",
            lastUpdated: new Date(),
          } as TokenPriceResult,
        };
      }
    });

    const settledResults = await Promise.allSettled(promises);

    settledResults.forEach((result) => {
      if (result.status === "fulfilled") {
        results[result.value.symbol] = result.value.price;
      }
    });

    return results;
  }

  /**
   * Clear price cache
   */
  clearCache(): void {
    this.priceCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.priceCache.size,
      entries: Array.from(this.priceCache.keys()),
    };
  }

  /**
   * Check if token is a stable coin
   */
  isStableCoin(tokenSymbol: string): boolean {
    return ["USDC", "USDT", "DAI", "USDP"].includes(tokenSymbol.toUpperCase());
  }
}

// Export singleton instance
export const priceService = new PriceService();
