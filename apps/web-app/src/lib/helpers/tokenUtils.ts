import { getAvailableTokens } from "./stellar/soroswap";
import type { Token } from "./stellar/soroswap";
import {
  STELLAR_TOKEN_ICON_MAP,
  STELLAR_FALLBACK_CONTRACTS,
} from "@/lib/constants/tokenIcons";

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
 * Convert a decimal amount into its smallest on-chain integer unit.
 *
 * String/BigInt-safe: parses the decimal string directly with no float
 * multiplication, so values like "0.41" convert exactly (4100000n, not
 * 4099999n). Fractional digits beyond `decimals` are truncated (floored).
 *
 * For money paths, pass the raw user string rather than a parsed number —
 * a `number` argument is coerced via toString() and may already carry
 * float error before it reaches this function.
 */
export const toSmallestUnit = (
  amount: string | number,
  decimals: number = 7
): bigint => {
  const str = typeof amount === "number" ? amount.toString() : amount.trim();
  if (str === "" || isNaN(Number(str))) return 0n;

  const negative = str.startsWith("-");
  const unsigned = negative ? str.slice(1) : str;
  const [whole = "0", frac = ""] = unsigned.split(".");

  const fracTruncated = frac.slice(0, decimals).padEnd(decimals, "0");
  const digits = `${whole}${fracTruncated}`.replace(/^0+(?=\d)/, "");

  const result = BigInt(digits || "0");
  return negative ? -result : result;
};

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

export const getExplorerUrl = (txHash: string, network?: string): string => {
  const networkParam = network === "PUBLIC" ? "" : `/${network?.toLowerCase()}`;
  return `https://stellar.expert/explorer${networkParam}/tx/${txHash}`;
};

export const sanitizeAmountInput = (value: string): string => {
  const stripped = value.replace(/[^0-9.]/g, "");
  const parts = stripped.split(".");
  return parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : stripped;
};

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

export const getTokenIcon = (
  token:
    | { type: "native" | "contract"; code?: string; contract?: string }
    | string
): string | null => {
  let tokenCode: string | null = null;

  if (typeof token === "string") {
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
