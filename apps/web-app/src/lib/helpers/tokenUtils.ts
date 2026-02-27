/**
 * Utility functions for swap operations (shared Stellar + EVM)
 */

import { isEVMToken, type EVMToken } from "@/lib/types/evmToken";
import { getAvailableTokens } from "./stellar/soroswap";
import type { Token } from "./stellar/soroswap";
import {
  EVM_TOKEN_ADDRESS_TO_SYMBOL,
  EVM_TOKEN_ICON_MAP,
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
 * Extracts a symbol string from any token variant used in EVM swaps.
 * Falls back to `fallback` when the token doesn't carry a symbol.
 */
export const getEvmTokenSymbol = (
  token: Token | string | EVMToken,
  fallback: string = ""
): string => {
  if (typeof token === "string") return token;
  if (isEVMToken(token)) return token.symbol || fallback;
  return fallback;
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
 * Converts a token (any format) to a stable string identifier.
 *
 * @param token - Token in any of the three formats used across the app
 * @param availableTokens - Stellar token registry (code → { contract })
 * @param evmTokens - EVM token registry for the active chain (symbol → token info)
 */
export const getTokenId = (
  token: Token | string | EVMToken,
  availableTokens: Record<string, { contract: string }>,
  evmTokens: Record<string, unknown> = {}
): string => {
  if (isEVMToken(token)) {
    return token.symbol || "";
  }

  if (typeof token === "string") {
    if (evmTokens[token]) return token;
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
    | { symbol?: string; address?: string }
): string | null => {
  let tokenCode: string | null = null;
  let isEVM = false;

  if (
    typeof token === "object" &&
    "symbol" in token &&
    "address" in token &&
    !("type" in token)
  ) {
    tokenCode = token.symbol || null;
    isEVM = true;
  } else if (typeof token === "string") {
    const addressLower = token.toLowerCase();

    if (EVM_TOKEN_ADDRESS_TO_SYMBOL[addressLower]) {
      tokenCode = EVM_TOKEN_ADDRESS_TO_SYMBOL[addressLower];
      isEVM = true;
    } else if (Object.values(EVM_TOKEN_ADDRESS_TO_SYMBOL).includes(token)) {
      tokenCode = token;
      isEVM = true;
    } else if (["ETH", "BNB", "USDC", "USDT"].includes(token.toUpperCase())) {
      tokenCode = token.toUpperCase();
      isEVM = true;
    } else {
      // Stellar contract address — look up in registry then fallback map
      try {
        const availableTokens = getAvailableTokens();
        for (const [code, info] of Object.entries(availableTokens)) {
          if (info.contract === token) {
            tokenCode = code;
            isEVM = false;
            break;
          }
        }
      } catch {
        tokenCode = STELLAR_FALLBACK_CONTRACTS[token] || null;
        isEVM = false;
      }

      if (!tokenCode) {
        tokenCode = token.toUpperCase();
        isEVM = false;
      }
    }
  } else if (typeof token === "object" && "type" in token) {
    tokenCode = token.type === "native" ? "XLM" : token.code || null;
    isEVM = false;
  }

  if (!tokenCode) return null;
  return isEVM
    ? (EVM_TOKEN_ICON_MAP[tokenCode] ?? null)
    : (STELLAR_TOKEN_ICON_MAP[tokenCode] ?? null);
};
