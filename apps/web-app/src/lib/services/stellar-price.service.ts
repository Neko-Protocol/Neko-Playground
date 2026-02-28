/**
 * Stellar Price Service
 * Handles token price fetching for Stellar: RWA Oracle and CoinGecko (non-RWA).
 */

import oracleClient from "@/lib/clients/oracle";
import { PRICE_ERROR_DELAY_MS, RWA_TOKENS } from "@/lib/constants/wallet";

/**
 * Map token codes to CoinGecko IDs (for non-RWA tokens)
 */
const TOKEN_PRICE_MAP: Record<string, string> = {
  XLM: "stellar",
  USDC: "usd-coin",
};

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;
const REQUEST_TIMEOUT_MS = 10000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class StellarPriceService {
  /**
   * Whether the given token code is an RWA token (oracle-backed).
   */
  isRWAToken(tokenCode: string): boolean {
    return RWA_TOKENS.includes(tokenCode);
  }

  /**
   * Get token price from RWA Oracle by contract address.
   */
  async getRWAOraclePrice(contractAddress: string): Promise<number> {
    try {
      const asset: { tag: "Stellar"; values: readonly [string] } = {
        tag: "Stellar",
        values: [contractAddress] as readonly [string],
      };
      const result = await oracleClient.lastprice(
        { asset },
        { simulate: true }
      );

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
        let validTimestamp = Number(priceData.timestamp);
        const now = Math.floor(Date.now() / 1000);

        if (validTimestamp > now) {
          validTimestamp = now;
        }

        const priceValue = BigInt(priceData.price.toString());
        const decimals = 7;
        return Number(priceValue) / Math.pow(10, decimals);
      }

      await sleep(PRICE_ERROR_DELAY_MS);
      return 0;
    } catch (error) {
      console.error(
        `Failed to fetch RWA oracle price for ${contractAddress}:`,
        error
      );
      await sleep(PRICE_ERROR_DELAY_MS);
      return 0;
    }
  }

  /**
   * Get token price in USD from CoinGecko (for non-RWA tokens).
   * Uses retries with exponential backoff. No fallback prices; returns 0 on failure so UI can show an error.
   */
  async getTokenPrice(tokenCode: string, retryCount = 0): Promise<number> {
    if (!tokenCode || typeof tokenCode !== "string") {
      return 0;
    }

    const coinGeckoId = TOKEN_PRICE_MAP[tokenCode];

    if (!coinGeckoId) {
      console.warn(`No CoinGecko ID mapping found for token: ${tokenCode}`);
      await sleep(PRICE_ERROR_DELAY_MS);
      return 0;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        REQUEST_TIMEOUT_MS
      );

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

      const shouldRetry =
        retryCount < MAX_RETRIES &&
        (errorMessage.includes("Failed to fetch") ||
          errorMessage.includes("NetworkError") ||
          errorMessage.includes("AbortError") ||
          errorMessage.includes("429") ||
          /5\d{2}/.test(errorMessage));

      if (shouldRetry) {
        const delay = BASE_DELAY_MS * Math.pow(2, retryCount);
        await sleep(delay);
        return this.getTokenPrice(tokenCode, retryCount + 1);
      }

      await sleep(PRICE_ERROR_DELAY_MS);
      return 0;
    }
  }
}

export const stellarPriceService = new StellarPriceService();
