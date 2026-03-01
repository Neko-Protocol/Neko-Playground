import type { Asset, RWAMetadata } from "@neko/oracle";
import { ORACLE_DECIMALS, PRICE_DISPLAY_DECIMALS } from "../constants/oracle";

/** Returns the asset identifier string (e.g. ticker). */
export const formatAsset = (asset: Asset): string => asset.values[0];

/**
 * Format a raw oracle price (bigint) to a display string with fixed decimals.
 * Single source of truth for price formatting across the stocks feature.
 */
export const formatPrice = (
  price: bigint,
  decimals: number = ORACLE_DECIMALS,
  displayDecimals: number = PRICE_DISPLAY_DECIMALS
): string => {
  if (price === BigInt(0)) {
    return "$0.00";
  }

  const divisor = BigInt(10 ** decimals);
  const whole = price / divisor;
  const fractional = price % divisor;

  let fractionalStr = fractional.toString().padStart(decimals, "0");
  fractionalStr = fractionalStr.substring(0, displayDecimals);

  const wholeStr = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  return `$${wholeStr}.${fractionalStr}`;
};

/**
 * Compute percentage change between current and previous price.
 * Returns null if previous is 0 or inputs are invalid.
 */
export const calculatePriceChange = (
  current: number,
  previous: number
): number | null => {
  if (
    previous === 0 ||
    !Number.isFinite(current) ||
    !Number.isFinite(previous)
  ) {
    return null;
  }
  return ((current - previous) / previous) * 100;
};

export const formatAssetType = (type: RWAMetadata["asset_type"]): string => {
  if (!type) return "Unknown";
  return type.tag ?? "Unknown";
};

export const formatComplianceStatus = (
  status: RWAMetadata["regulatory_info"]["compliance_status"]
): string => {
  if (!status) return "Unknown";
  return status.tag ?? "Unknown";
};
