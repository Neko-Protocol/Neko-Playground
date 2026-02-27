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
    },
    USDC: {
      name: "USDCoin",
      contract: "CB3TLW74NBIOT3BUWOZ3TUM6RFDF6A4GVIRUQRQZABG5KPOUL4JJOV2F",
      code: "USDC",
      decimals: 7,
    },
    NVDA: {
      name: "NVIDIA Token",
      contract: "CBTPNPK5HDORKWSOVM22FCJXDVAMRA6Y2J4COGFWAU7O6VHJ6PV2KSUY",
      code: "NVDA",
      decimals: 7,
    },
    AAPL: {
      name: "APPLE Token",
      contract: "CB7ICLBZWLGCULENOTKZAW57WDVM4A5ENFCQ7HRNW4S4SSPGAFY6T26P",
      code: "AAPL",
      decimals: 7,
    },
    PLTR: {
      name: "PALANTIR Token",
      contract: "CBDCAAID46PGO2BXPOCQJVODXGDNWYFUHCMRRHOP56PZZCOVAIOEGA3C",
      code: "PLTR",
      decimals: 7,
    },
    TSLA: {
      name: "TESLA Token",
      contract: "CANDL3RC3BWGGQEXIOH76ZFWOGPLCNXEUJG25BAQKCRN7WLXXXHUC35O",
      code: "TSLA",
      decimals: 7,
    },
    META: {
      name: "META Token",
      contract: "CAVCEHVJYV4R6LO3YXDOYHZJEPI4B4R4JUX4BLH4OBVNIFDWD77RSJLN",
      code: "META",
      decimals: 7,
    },
  },
  standalone: {
    XLM: {
      name: "Stellar Lumens",
      contract: "CDMLFMKMMD7MWZP3FKUBZPVHTUEDLSX4BYGYKH4GCESXYHS3IHQ4EIG4",
      code: "XLM",
      decimals: 7,
    },
    USDC: {
      name: "USDCoin",
      contract: "CB3TLW74NBIOT3BUWOZ3TUM6RFDF6A4GVIRUQRQZABG5KPOUL4JJOV2F",
      code: "USDC",
      decimals: 7,
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
