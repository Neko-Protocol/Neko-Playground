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
    await sleep(PRICE_ERROR_DELAY_MS);
    return 0;
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

    if (isStablecoin) return STABLECOIN_FALLBACK_USD;
    return 0;
  }
}

export const stellarPriceService = new StellarPriceService();
