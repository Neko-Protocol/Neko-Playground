/**
 * Price Service Types
 * Type definitions for price-related operations
 */

export interface TokenPriceResult {
  price: number;
  source: string;
  lastUpdated?: Date;
}

export interface PriceFetchOptions {
  /** Force refresh even if cached */
  forceRefresh?: boolean;
  /** Timeout in milliseconds */
  timeout?: number;
}
