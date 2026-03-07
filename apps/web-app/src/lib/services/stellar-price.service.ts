import oracleClient from "@/lib/clients/oracle";
import {
  PRICE_ERROR_DELAY_MS,
  STABLECOIN_FALLBACK_USD,
} from "@/lib/constants/wallet";
import {
  getAssetsConfig,
  getRwaTokenCodes,
  getStablecoinCodes,
} from "@/lib/constants/assets.config";

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;
const REQUEST_TIMEOUT_MS = 10000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class StellarPriceService {
  isRWAToken(tokenCode: string): boolean {
    return getRwaTokenCodes().includes(tokenCode);
  }

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
        | { tag: "None"; values: void }
        | null
        | undefined;

      if (optionResult?.tag === "Some") {
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

  async getTokenPrice(tokenCode: string, retryCount = 0): Promise<number> {
    if (!tokenCode || typeof tokenCode !== "string") {
      return 0;
    }

    const assets = getAssetsConfig();
    const coinGeckoId = assets[tokenCode]?.coinGeckoId;

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

  async getPrice(tokenCode: string, contractAddress?: string): Promise<number> {
    if (!tokenCode || typeof tokenCode !== "string") return 0;

    const assets = getAssetsConfig();
    const asset = assets[tokenCode];
    const isStablecoin = getStablecoinCodes().includes(tokenCode);

    if (asset?.priceSource === "oracle" && contractAddress) {
      const price = await this.getRWAOraclePrice(contractAddress);
      if (price > 0) return price;
      if (isStablecoin) return STABLECOIN_FALLBACK_USD;
      return 0;
    }

    if (asset?.coinGeckoId) {
      const price = await this.getTokenPrice(tokenCode);
      if (price > 0) return price;
      if (isStablecoin) return STABLECOIN_FALLBACK_USD;
      return 0;
    }

    if (isStablecoin) return STABLECOIN_FALLBACK_USD;
    return 0;
  }
}

export const stellarPriceService = new StellarPriceService();
