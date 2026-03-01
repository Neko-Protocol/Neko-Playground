/**
 * Shared types for the stocks feature.
 */

export interface StockInfo {
  logo: string;
  name: string;
  description: string;
}

export interface AssetPricePoint {
  price: bigint;
  timestamp: bigint;
}

export interface PriceChartDatum {
  timestamp: string;
  price: number;
  fullTimestamp: number;
  date: Date;
}
