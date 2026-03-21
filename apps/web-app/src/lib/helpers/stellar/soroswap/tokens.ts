import type { Token } from "../../../types/soroswapTypes";
import {
  getAssetsConfig,
  getCurrentNetworkId,
  type AssetConfig,
} from "@/lib/constants/assets.config";

export type TokenInfo = Pick<
  AssetConfig,
  "name" | "contract" | "code" | "decimals" | "icon"
>;

export const getCurrentNetwork = (): string => getCurrentNetworkId();

export const getAvailableTokens = (): Record<string, TokenInfo> => {
  return getAssetsConfig();
};

export const getTokens = (): Record<string, string> => {
  const tokens = getAvailableTokens();
  const result: Record<string, string> = {};
  Object.entries(tokens).forEach(([code, info]) => {
    result[code] = info.contract;
  });
  return result;
};

export const getTokenAddress = (token: Token | string): string => {
  if (typeof token === "string") {
    // Already a valid Soroban contract address
    if (token.startsWith("C") && token.length === 56) {
      return token;
    }
    // Try to look up by token code (e.g. "XLM" → contract address)
    const tokens = getTokens();
    if (tokens[token]) {
      return tokens[token];
    }
    return token;
  }

  if (token.type === "native") {
    const tokens = getTokens();
    return tokens.XLM ?? getAvailableTokens().XLM?.contract ?? "";
  }

  if (token.contract) {
    return token.contract;
  }

  throw new Error(
    "Invalid token format: must be string address or Token with contract"
  );
};

export const TOKENS: Record<string, string> = getTokens();
