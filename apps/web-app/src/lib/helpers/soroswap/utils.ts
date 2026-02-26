import { SoroswapSDK, SupportedNetworks } from "@soroswap/sdk";
import type { Token } from "../../types/soroswapTypes";
import { getCurrentNetwork, getAvailableTokens, getTokens } from "./tokens";

const SOROSWAP_API_URL = "https://api.soroswap.finance";
const DEFAULT_TIMEOUT = 50000;

// ========================================
// API KEY MANAGEMENT
// ========================================

/**
 * Get API key from environment or localStorage
 */
export const getApiKey = (): string | null => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const envKey = process.env.NEXT_PUBLIC_SOROSWAP_API_KEY;
  const envKeyStr = typeof envKey === "string" ? envKey : "";
  if (envKeyStr && envKeyStr.trim() !== "") {
    return envKeyStr.trim();
  }
  const localKey = localStorage.getItem("soroswap_api_key");
  if (localKey && localKey.trim() !== "") {
    return localKey.trim();
  }
  return null;
};

/**
 * Set API key in localStorage
 */
export const setApiKey = (apiKey: string): void => {
  localStorage.setItem("soroswap_api_key", apiKey);
};

/**
 * Check if API key is configured
 */
export const hasApiKey = (): boolean => {
  return getApiKey() !== null;
};

// ========================================
// SDK MANAGEMENT
// ========================================

/**
 * Get SDK network enum from current network string
 */
export const getSDKNetwork = (): SupportedNetworks => {
  const network = getCurrentNetwork();
  const networkLower = network.toLowerCase();

  if (networkLower === "mainnet" || networkLower === "public") {
    return SupportedNetworks.MAINNET;
  }
  return SupportedNetworks.TESTNET;
};

let sdkInstance: SoroswapSDK | null = null;
let sdkNetwork: SupportedNetworks | null = null;

/**
 * Invalidate SDK instance (call when network changes)
 */
export const invalidateSoroswapSDK = (): void => {
  sdkInstance = null;
  sdkNetwork = null;
};

/**
 * Get or create Soroswap SDK instance (singleton pattern)
 */
export const getSoroswapSDK = (): SoroswapSDK => {
  const currentNetwork = getSDKNetwork();

  if (sdkInstance && sdkNetwork === currentNetwork) {
    return sdkInstance;
  }

  const apiKey = getApiKey();

  if (!apiKey) {
    throw new Error(
      "Soroswap API key is not configured. Please add your API key in the settings or via environment variable PUBLIC_SOROSWAP_API_KEY (or VITE_SOROSWAP_API_KEY). Get your key at https://api.soroswap.finance/login"
    );
  }

  sdkInstance = new SoroswapSDK({
    apiKey,
    baseUrl: SOROSWAP_API_URL,
    defaultNetwork: currentNetwork,
    timeout: DEFAULT_TIMEOUT,
  });

  sdkNetwork = currentNetwork;

  return sdkInstance;
};

// ========================================
// API REQUEST HELPER
// ========================================

/**
 * Make API request to Soroswap REST API
 */
export const makeAPIRequest = async <T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> => {
  const apiKey = getApiKey();

  if (!apiKey) {
    throw new Error(
      "Soroswap API key is not configured. Please add your API key in the settings or via environment variable PUBLIC_SOROSWAP_API_KEY (or VITE_SOROSWAP_API_KEY). Get your key at https://api.soroswap.finance/login"
    );
  }

  const url = `${SOROSWAP_API_URL}${endpoint}`;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
    ...options.headers,
  };

  try {
    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `API request failed: ${response.status} ${response.statusText}. ${JSON.stringify(errorData)}`
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const jsonData = await response.json();
    return jsonData as T;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Unknown error occurred during API request");
  }
};

// ========================================
// AMOUNT CONVERSION
// ========================================

/**
 * Convert amount to smallest unit (stroops for XLM with 7 decimals)
 */
export const toSmallestUnit = (
  amount: string,
  decimals: number = 7
): bigint => {
  const numAmount = parseFloat(amount);
  if (isNaN(numAmount)) return BigInt(0);

  const multiplier = BigInt(10 ** decimals);
  const amountFloat = numAmount * Number(multiplier);
  return BigInt(Math.floor(amountFloat));
};

// ========================================
// FORMAT / VALIDATION HELPERS
// ========================================

/**
 * Verify if a contract address is valid format
 */
export const isValidContractAddress = (address: string): boolean => {
  return address.startsWith("C") && address.length === 56;
};

/**
 * Get explorer URL for a token contract
 */
export const getTokenExplorerUrl = (
  contractAddress: string,
  network: string = "testnet"
): string => {
  const networkParam = network === "mainnet" ? "" : `/${network}`;
  return `https://stellar.expert/explorer${networkParam}/contract/${contractAddress}`;
};

/**
 * Format token for API request
 * Assets must be contract addresses as strings
 */
export const formatTokenForAPI = (token: Token | string): string => {
  if (typeof token === "string") {
    return token;
  }

  if (token.type === "native") {
    const tokens = getTokens();
    return tokens.XLM ?? getAvailableTokens().XLM?.contract ?? "";
  }

  if (token.contract) {
    if (!token.contract.startsWith("C")) {
      throw new Error(
        `Invalid contract address format: ${token.contract}. Contract addresses should start with 'C'.`
      );
    }
    return token.contract;
  }

  if (token.code && token.issuer) {
    throw new Error(
      "Classic assets (code+issuer) not supported. Use contract addresses instead."
    );
  }

  throw new Error(
    "Invalid token format: must be string address or Token with contract"
  );
};
