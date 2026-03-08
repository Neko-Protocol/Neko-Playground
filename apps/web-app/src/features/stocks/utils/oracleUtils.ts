import type { Asset, RWAMetadata } from "@neko/oracle";
import { ORACLE_DECIMALS, PRICE_DISPLAY_DECIMALS } from "../constants/oracle";

export const formatAsset = (asset: Asset): string => asset.values[0];

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
