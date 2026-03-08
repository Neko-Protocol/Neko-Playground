export type PriceSource = "oracle" | "coingecko";

export interface AssetConfig {
  code: string;
  name: string;
  contract: string;
  decimals: number;
  icon: string;
  priceSource: PriceSource;
  coinGeckoId?: string;
  isStablecoin?: boolean;
}

type NetworkId = "testnet" | "standalone" | "mainnet";

const ASSETS_BY_NETWORK: Record<NetworkId, Record<string, AssetConfig>> = {
  testnet: {
    XLM: {
      code: "XLM",
      name: "Stellar Lumens",
      contract: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
      decimals: 7,
      icon: "/assets/xlm-logo.png",
      priceSource: "coingecko",
      coinGeckoId: "stellar",
    },
    USDC: {
      code: "USDC",
      name: "USD Coin",
      contract: "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
      decimals: 7,
      icon: "/assets/usdc-logo.png",
      priceSource: "coingecko",
      coinGeckoId: "usd-coin",
      isStablecoin: true,
    },
    USTRY: {
      code: "USTRY",
      name: "US Treasury Token",
      contract: "CC6SODKGOTFEDWVNPR6ESJC3GL7NC5Y4DVFKYGATZJ74F2YXHTW4RJ6D",
      decimals: 7,
      icon: "/assets/ustry-logo.png",
      priceSource: "oracle",
      isStablecoin: false,
    },
    TESOURO: {
      code: "TESOURO",
      name: "Tesouro Token",
      contract: "CA55OO3U556GXABJKDYP3QCGZ6AFNZPB27TROYP42AQPFFYPKU5EDOUH",
      decimals: 7,
      icon: "/assets/tesouro-logo.png",
      priceSource: "oracle",
      isStablecoin: false,
    },
    CETES: {
      code: "CETES",
      name: "CETES Token",
      contract: "CCGWKS4GLAGPYIAOLBH6JM5RKUPMUCN47VRAEXAJWJFKXSXQ33VIRUAA",
      decimals: 7,
      icon: "/assets/cetes-logo.png",
      priceSource: "oracle",
      isStablecoin: false,
    },
    USDY: {
      code: "USDY",
      name: "US Dollar Yield",
      contract: "CBVLFSVBZGHVAH6CV4JQYPBJSX75VFR2NJC7CQX7QKQ7KOLGQZOZAGQK",
      decimals: 7,
      icon: "/assets/usdy-logo.png",
      priceSource: "oracle",
      isStablecoin: true,
    },
    PYUSD: {
      code: "PYUSD",
      name: "PayPal USD",
      contract: "CBCB5UDYZENTIUVVA7SHQOCVVCDXDMHEKJHHFM3OQKU2E5CAF2B62TIO",
      decimals: 7,
      icon: "/assets/pyusd-logo.png",
      priceSource: "oracle",
      isStablecoin: true,
    },
  },
  standalone: {
    XLM: {
      code: "XLM",
      name: "Stellar Lumens",
      contract: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
      decimals: 7,
      icon: "/assets/xlm-logo.png",
      priceSource: "coingecko",
      coinGeckoId: "stellar",
    },
    USDC: {
      code: "USDC",
      name: "USD Coin",
      contract: "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
      decimals: 7,
      icon: "/assets/usdc-logo.png",
      priceSource: "coingecko",
      coinGeckoId: "usd-coin",
      isStablecoin: true,
    },
  },
  mainnet: {},
};

import { stellarNetwork } from "@/lib/constants/network";

function getNetworkId(): NetworkId {
  const network = stellarNetwork?.toLowerCase() || "testnet";
  if (network === "local" || network === "standalone") return "standalone";
  if (network === "public" || network === "mainnet") return "mainnet";
  return "testnet";
}

export function getAssetsConfig(): Record<string, AssetConfig> {
  const networkId = getNetworkId();
  return ASSETS_BY_NETWORK[networkId] ?? ASSETS_BY_NETWORK.testnet;
}

export function getRwaTokenCodes(): string[] {
  const assets = getAssetsConfig();
  return Object.values(assets)
    .filter((a) => a.priceSource === "oracle")
    .map((a) => a.code);
}

export function getStablecoinCodes(): string[] {
  const assets = getAssetsConfig();
  return Object.values(assets)
    .filter((a) => a.isStablecoin)
    .map((a) => a.code);
}

export function getTokenIconMap(): Record<string, string> {
  const assets = getAssetsConfig();
  const map: Record<string, string> = {};
  for (const a of Object.values(assets)) {
    map[a.code] = a.icon;
  }
  return map;
}

export function getCurrentNetworkId(): NetworkId {
  return getNetworkId();
}

export function getContractToCodeMap(): Record<string, string> {
  const assets = getAssetsConfig();
  const map: Record<string, string> = {};
  for (const a of Object.values(assets)) {
    map[a.contract] = a.code;
  }
  return map;
}
