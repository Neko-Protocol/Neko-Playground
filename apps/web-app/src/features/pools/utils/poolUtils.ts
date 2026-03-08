import {
  formatLiquidity as libFormatLiquidity,
  safeParseFloat as libSafeParseFloat,
} from "@/lib/helpers/formatUtils";

export const formatLiquidity = libFormatLiquidity;

export function safeParseFloat(
  value: string | number | null | undefined
): number {
  return libSafeParseFloat(value);
}
