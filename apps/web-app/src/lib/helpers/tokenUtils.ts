/**
 * Utility functions for swap operations (Stellar)
 */

import { getAvailableTokens } from "./stellar/soroswap";
import type { Token } from "./stellar/soroswap";
import {
  STELLAR_TOKEN_ICON_MAP,
  STELLAR_FALLBACK_CONTRACTS,
} from "@/lib/constants/tokenIcons";

/**
 * Format amount based on token decimals
 */
export const formatSwapAmount = (
  amount: string | number,
  decimals: number = 7
): string => {
  const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(numAmount)) return "0";

  const formatter = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: decimals,
  });

  return formatter.format(numAmount);
};

/**
 * Convert amount to smallest unit (stroops for XLM, smallest unit for tokens)
 */
export const toSmallestUnit = (
  amount: string | number,
  decimals: number = 7
): string => {
  const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(numAmount)) return "0";

  const multiplier = Math.pow(10, decimals);
  const result = Math.floor(numAmount * multiplier).toString();
  return result;
};

/**
 * Convert from smallest unit to human-readable format
 */
export const fromSmallestUnit = (
  amount: string,
  decimals: number = 7
): string => {
  const numAmount = BigInt(amount);
  const divisor = BigInt(Math.pow(10, decimals));
  const whole = numAmount / divisor;
  const fractional = numAmount % divisor;

  if (fractional === BigInt(0)) {
    return whole.toString();
  }

  const fractionalStr = fractional.toString().padStart(decimals, "0");
  const trimmedFractional = fractionalStr.replace(/0+$/, "");
  return `${whole}.${trimmedFractional}`;
};

/**
 * Get explorer URL for a transaction
 */
export const getExplorerUrl = (txHash: string, network?: string): string => {
  const networkParam = network === "PUBLIC" ? "" : `/${network?.toLowerCase()}`;
  return `https://stellar.expert/explorer${networkParam}/tx/${txHash}`;
};

/**
 * Strips non-numeric characters and prevents multiple decimal points.
 * Suitable for amount input fields.
 */
export const sanitizeAmountInput = (value: string): string => {
  const stripped = value.replace(/[^0-9.]/g, "");
  const parts = stripped.split(".");
  return parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : stripped;
};

/**
 * Converts a Stellar token to a stable string identifier.
 */
export const getTokenId = (
  token: Token | string,
  availableTokens: Record<string, { contract: string }>
): string => {
  if (typeof token === "string") {
    for (const [code, info] of Object.entries(availableTokens)) {
      if (info.contract === token) return code;
    }
    return token;
  }

  if (token.type === "native") return "XLM";
  if (token.contract) {
    for (const [code, info] of Object.entries(availableTokens)) {
      if (info.contract === token.contract) return code;
    }
    return token.contract;
  }
  if (token.code) return token.code;
  return "";
};

/**
 * Get token icon/image path based on token code or address.
 * Returns null if no icon is found.
 */
export const getTokenIcon = (
  token:
    | { type: "native" | "contract"; code?: string; contract?: string }
    | string
): string | null => {
  let tokenCode: string | null = null;

  if (typeof token === "string") {
    // Stellar contract address — look up in registry then fallback map
    try {
      const availableTokens = getAvailableTokens();
      for (const [code, info] of Object.entries(availableTokens)) {
        if (info.contract === token) {
          tokenCode = code;
          break;
        }
      }
    } catch {
      tokenCode = STELLAR_FALLBACK_CONTRACTS[token] || null;
    }

    if (!tokenCode) {
      tokenCode = token.toUpperCase();
    }
  } else if (typeof token === "object" && "type" in token) {
    tokenCode = token.type === "native" ? "XLM" : token.code || null;
  }

  if (!tokenCode) return null;
  return STELLAR_TOKEN_ICON_MAP[tokenCode] ?? null;
};
