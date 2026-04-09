export interface AssetConfig {
  code: string;
  name: string;
  contract: string;
  decimals: number;
  icon: string;
  priceSource: "oracle";
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
      priceSource: "oracle",
    },
    USDC: {
      code: "USDC",
      name: "USD Coin",
      contract: "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
      decimals: 7,
      icon: "/assets/usdc-logo.png",
      priceSource: "oracle",
      isStablecoin: true,
    },
    USTRY: {
      code: "USTRY",
      name: "US Treasury Token",
      contract: "CCAYGJWQI5NJN7XRVNSENF47PICNSNTG4FAQHHFOJWZIRTEAC5JPMLGN",
      decimals: 7,
      icon: "/assets/ustry-logo.png",
      priceSource: "oracle",
      isStablecoin: false,
    },
    TESOURO: {
      code: "TESOURO",
      name: "Tesouro Token",
      contract: "CAPFX3QEAHE7JVT6E7PYZQTFSVS5Z7AV4RE7GRJRVCPKXGQHCWSCOMTW",
      decimals: 7,
      icon: "/assets/tesouro-logo.png",
      priceSource: "oracle",
      isStablecoin: false,
    },
    CETES: {
      code: "CETES",
      name: "CETES Token",
      contract: "CAJ4B2ZWU2GA7UYQZ7N7QQCTZAUSSXNKKQ326ADYVH3ALN4FFQ6LPO4U",
      decimals: 7,
      icon: "/assets/cetes-logo.png",
      priceSource: "oracle",
      isStablecoin: false,
    },
    USDY: {
      code: "USDY",
      name: "US Dollar Yield",
      contract: "CDRQV3D3GLWF73MWTEQWFZWMBQ47KZ3KECYPOBKBDRQBWQQ74KDH5ECT",
      decimals: 7,
      icon: "/assets/usdy-logo.png",
      priceSource: "oracle",
      isStablecoin: true,
    },
    PYUSD: {
      code: "PYUSD",
      name: "PayPal USD",
      contract: "CBNHH37BJ2G4ZT6PLWDXPOWHKLR75IGNLBRCXZNOS7YPAYS53JPEPSSS",
      decimals: 7,
      icon: "/assets/pyusd-logo.png",
      priceSource: "oracle",
      isStablecoin: true,
    },
    KTB: {
      code: "KTB",
      name: "Korean Treasury Bond",
      contract: "CCACIMR6I2XR35HSQSPYNTIZSK7IRVLPKAMSZPHW57SSUC44IZGN3TCX",
      decimals: 7,
      icon: "/assets/ktb.png",
      priceSource: "oracle",
      isStablecoin: false,
    },
  },
  standalone: {
    XLM: {
      code: "XLM",
      name: "Stellar Lumens",
      contract: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
      decimals: 7,
      icon: "/assets/xlm-logo.png",
      priceSource: "oracle",
    },
    USDC: {
      code: "USDC",
      name: "USD Coin",
      contract: "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
      decimals: 7,
      icon: "/assets/usdc-logo.png",
      priceSource: "oracle",
      isStablecoin: true,
    },
  },
  mainnet: {
    XLM: {
      code: "XLM",
      name: "Stellar Lumens",
      contract: "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA",
      decimals: 7,
      icon: "/assets/xlm-logo.png",
      priceSource: "oracle",
    },
    USDC: {
      code: "USDC",
      name: "USD Coin",
      contract: "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
      decimals: 7,
      icon: "/assets/usdc-logo.png",
      priceSource: "oracle",
      isStablecoin: true,
    },
    USTRY: {
      code: "USTRY",
      name: "US Treasury Token",
      contract: "CBLV4ATSIWU67CFSQU2NVRKINQIKUZ2ODSZBUJTJ43VJVRSBTZYOPNUR",
      decimals: 7,
      icon: "/assets/ustry-logo.png",
      priceSource: "oracle",
      isStablecoin: false,
    },
    TESOURO: {
      code: "TESOURO",
      name: "Tesouro Token",
      contract: "CD6M4R2322BYCY2LNWM74PEBQAQ63SA3DUJLI3L4225U4ZVCLMSCBCIS",
      decimals: 7,
      icon: "/assets/tesouro-logo.png",
      priceSource: "oracle",
      isStablecoin: false,
    },
    CETES: {
      code: "CETES",
      name: "CETES Token",
      contract: "CAL6ER2TI6CTRAY6BFXWNWA7WTYXUXTQCHUBCIBU5O6KM3HJFG6Z6VXV",
      decimals: 7,
      icon: "/assets/cetes-logo.png",
      priceSource: "oracle",
      isStablecoin: false,
    },
    USDY: {
      code: "USDY",
      name: "US Dollar Yield",
      contract: "CB3YA656OYIHU57657I5KGSBRHE5I3OZU4VFC22PYAOANFZHEWNYGAGP",
      decimals: 7,
      icon: "/assets/usdy-logo.png",
      priceSource: "oracle",
      isStablecoin: true,
    },
    PYUSD: {
      code: "PYUSD",
      name: "PayPal USD",
      contract: "CCCRWH6Q3FNP3I2I57BDLM5AFAT7O6OF6GKQOC6SSJNDAVRZ57SPHGU2",
      decimals: 7,
      icon: "/assets/pyusd-logo.png",
      priceSource: "oracle",
      isStablecoin: true,
    },
  },
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
