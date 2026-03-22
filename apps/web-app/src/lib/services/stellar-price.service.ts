import oracleClient from "@/lib/clients/oracle";
import {
  PRICE_ERROR_DELAY_MS,
  STABLECOIN_FALLBACK_USD,
} from "@/lib/constants/wallet";
import {
  getRwaTokenCodes,
  getStablecoinCodes,
} from "@/lib/constants/assets.config";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class StellarPriceService {
  isRWAToken(tokenCode: string): boolean {
    // XLM is the native network token, not an RWA
    // Stablecoins are handled separately via fallback
    const stablecoinCodes = getStablecoinCodes();
    if (tokenCode === "XLM" || stablecoinCodes.includes(tokenCode)) {
      return false;
    }
    return getRwaTokenCodes().includes(tokenCode);
  }

  async getRWAOraclePrice(contractAddress: string): Promise<number> {
    if (
      !contractAddress ||
      !contractAddress.startsWith("C") ||
      contractAddress.length !== 56
    ) {
      return 0;
    }
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

    const isStablecoin = getStablecoinCodes().includes(tokenCode);
    if (isStablecoin) return STABLECOIN_FALLBACK_USD;

    if (this.isRWAToken(tokenCode) && contractAddress) {
      return this.getRWAOraclePrice(contractAddress);
    }

    return 0;
  }
}

export const stellarPriceService = new StellarPriceService();
