/**
 * Pools feature utilities.
 * Re-exports shared formatting from lib and adds pool-specific helpers.
 */

import {
  formatLiquidity as libFormatLiquidity,
  safeParseFloat as libSafeParseFloat,
} from "@/lib/helpers/formatUtils";

/** Re-export so the feature depends on its own utils that in turn depend on lib. */
export const formatLiquidity = libFormatLiquidity;

/**
 * Parse a value to number; returns 0 if NaN or invalid.
 */
export function safeParseFloat(
  value: string | number | null | undefined
): number {
  return libSafeParseFloat(value);
}
