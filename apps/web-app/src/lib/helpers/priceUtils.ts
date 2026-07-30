import { getAssetsConfig } from "@/lib/constants/assets.config";
import { stellarPriceService } from "@/lib/services/stellar-price.service";

/**
 * Fetches USD prices for the given asset codes in parallel.
 *
 * Map values are `null` when no USD price source is available (the service
 * returns 0 or the lookup throws). Callers must surface that state in the UI
 * rather than treating it as a zero price.
 */
export async function fetchUsdPriceMap(
  assetCodes: string[]
): Promise<Record<string, number | null>> {
  const uniqueCodes = [...new Set(assetCodes)];

  const entries = await Promise.all(
    uniqueCodes.map(async (code) => {
      try {
        const asset = getAssetsConfig()[code];
        const contract =
          asset?.priceSource === "oracle" ? asset.contract : undefined;
        const price = await stellarPriceService.getPrice(code, contract);
        return [code, price > 0 ? price : null] as const;
      } catch {
        return [code, null] as const;
      }
    })
  );

  return Object.fromEntries(entries);
}
