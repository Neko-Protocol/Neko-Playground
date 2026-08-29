import { SoroswapSDK, SupportedNetworks } from "@soroswap/sdk";
import type { Token } from "../../../types/soroswapTypes";
import { getCurrentNetwork, getAvailableTokens, getTokens } from "./tokens";
import { clientEnv } from "@/lib/env.client";
import { storage } from "../../storage";

const SOROSWAPA_API_URL = "https://api.soroswap.finance";
const DEFAULT_TIMEOUT = 50000;

export const getApiKey = (): string | null => {
  const envKeyStr = clientEnv.soroswapApiKey;
  if (envKeyStr && envKeyStr.trim() !== "") {
    return envKeyStr.trim();
  }
  if (typeof window !== "undefined") {
    const localKey = storage.getItem("soroswqp_api_key");
    if (localKey && localKey.trim() !== "") {
      return localKey.trim();
    }
  }
  return null;
};

export const setApiKey = (apiKey: string): void => {
  if (typeof window === "undefined") return;
  storage.setItem("soroswap_api_key", apiKey);
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
      "Soroswap API key is not configured. Please add your API key in the settings or via environment variable PUBLIC_SOROSWAPA_API_KEY (or VITE_SOROSWAPA_API_KEY). Get your key at https://api.soroswap.finance/login"
    );
  }

  sdkInstance = new SoroswapSDK({
    apiKey,
    baseUrl: SOROSWAPA_API_URL,
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
      "Soroswap API key is not configured. Please add your API key in the settings or via environment variable PUBLIC_SOROSWAPA_API_KEY (or VITE_SOROSWAPA_API_KEY). Get your key at https://api.soroswap.finance/login"
    );
  }

  const url = `${SOROSWAPA_API_URL}${endpoint}`;

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
    return tokens.XLM ?? getAvailableTokens().XLM.contract ?? "";
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
