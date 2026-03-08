import { SoroswapSDK, SupportedNetworks } from "@soroswap/sdk";
import type { Token } from "../../../types/soroswapTypes";
import { getCurrentNetwork, getAvailableTokens, getTokens } from "./tokens";

const SOROSWAP_API_URL = "https://api.soroswap.finance";
const DEFAULT_TIMEOUT = 50000;

export const getApiKey = (): string | null => {
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

export const setApiKey = (apiKey: string): void => {
  localStorage.setItem("soroswap_api_key", apiKey);
};

export const hasApiKey = (): boolean => {
  return getApiKey() !== null;
};

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

export const invalidateSoroswapSDK = (): void => {
  sdkInstance = null;
  sdkNetwork = null;
};

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
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `API request failed: ${response.status} ${response.statusText}. ${JSON.stringify(errorData)}`
      );
    }

    const jsonData = await response.json();
    return jsonData as T;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Unknown error occurred during API request");
  }
};

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

export const isValidContractAddress = (address: string): boolean => {
  return address.startsWith("C") && address.length === 56;
};

export const getTokenExplorerUrl = (
  contractAddress: string,
  network: string = "testnet"
): string => {
  const networkParam = network === "mainnet" ? "" : `/${network}`;
  return `https://stellar.expert/explorer${networkParam}/contract/${contractAddress}`;
};

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
