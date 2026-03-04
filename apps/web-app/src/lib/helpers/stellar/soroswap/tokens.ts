import { stellarNetwork } from "../../../constants/network";
import type { Token } from "../../../types/soroswapTypes";

// ========================================
// NETWORK DETECTION
// ========================================

/**
 * Get current network name
 */
export const getCurrentNetwork = (): string => {
  const network = stellarNetwork?.toLowerCase() || "testnet";

  if (network === "local" || network === "standalone") {
    return "standalone";
  }
  if (network === "public" || network === "mainnet") {
    return "mainnet";
  }
  return "testnet";
};

// ========================================
// TOKEN DEFINITIONS
// ========================================

interface TokenInfo {
  name: string;
  contract: string;
  code: string;
  decimals: number;
  icon?: string;
}

const TOKENS_BY_NETWORK: Record<string, Record<string, TokenInfo>> = {
  testnet: {
    XLM: {
      name: "Stellar Lumens",
      contract: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
      code: "XLM",
      decimals: 7,
      icon: "/assets/xlm-logo.png",
    },
    USDC: {
      name: "USD Coin",
      contract: "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
      code: "USDC",
      decimals: 7,
      icon: "/assets/usdc-logo.png",
    },
    USTRY: {
      name: "US Treasury Token",
      contract: "CC6SODKGOTFEDWVNPR6ESJC3GL7NC5Y4DVFKYGATZJ74F2YXHTW4RJ6D",
      code: "USTRY",
      decimals: 7,
      icon: "/assets/ustry-logo.png",
    },
    TESOURO: {
      name: "Tesouro Token",
      contract: "CA55OO3U556GXABJKDYP3QCGZ6AFNZPB27TROYP42AQPFFYPKU5EDOUH",
      code: "TESOURO",
      decimals: 7,
      icon: "/assets/tesouro-logo.png",
    },
    CETES: {
      name: "CETES Token",
      contract: "CCGWKS4GLAGPYIAOLBH6JM5RKUPMUCN47VRAEXAJWJFKXSXQ33VIRUAA",
      code: "CETES",
      decimals: 7,
      icon: "/assets/cetes-logo.png",
    },
    USDY: {
      name: "US Dollar Yield",
      contract: "CBVLFSVBZGHVAH6CV4JQYPBJSX75VFR2NJC7CQX7QKQ7KOLGQZOZAGQK",
      code: "USDY",
      decimals: 7,
      icon: "/assets/usdy-logo.png",
    },
    PYUSD: {
      name: "PayPal USD",
      contract: "CBCB5UDYZENTIUVVA7SHQOCVVCDXDMHEKJHHFM3OQKU2E5CAF2B62TIO",
      code: "PYUSD",
      decimals: 7,
      icon: "/assets/pyusd-logo.png",
    },
  },
  standalone: {
    XLM: {
      name: "Stellar Lumens",
      contract: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
      code: "XLM",
      decimals: 7,
      icon: "/assets/xlm-logo.png",
    },
    USDC: {
      name: "USD Coin",
      contract: "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
      code: "USDC",
      decimals: 7,
      icon: "/assets/usdc-logo.png",
    },
  },
  mainnet: {
    // Mainnet tokens - add as needed
  },
};

// ========================================
// TOKEN LOOKUP
// ========================================

/**
 * Get available tokens for current network
 */
export const getAvailableTokens = (): Record<string, TokenInfo> => {
  const network = getCurrentNetwork();
  return TOKENS_BY_NETWORK[network] ?? TOKENS_BY_NETWORK.testnet;
};

/**
 * Get token addresses for current network (dynamic based on network)
 * Use this instead of the static TOKENS object to ensure network-correct addresses
 */
export const getTokens = (): Record<string, string> => {
  const tokens = getAvailableTokens();
  const result: Record<string, string> = {};
  Object.entries(tokens).forEach(([code, info]) => {
    result[code] = info.contract;
  });
  return result;
};

/**
 * Get token address from Token object or string
 */
export const getTokenAddress = (token: Token | string): string => {
  if (typeof token === "string") {
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

/**
 * Common token definitions - using correct addresses for current network
 * @deprecated Use getTokens() instead for network-aware token lookup
 */
export const TOKENS: Record<string, string> = getTokens();
