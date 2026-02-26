import { createEVMToken, type EVMToken, ChainId } from "@/lib/types/evmToken";

// ========================================
// SUPPORTED CHAINS
// ========================================
export interface ChainConfig {
  id: number;
  name: string;
  icon: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

export const SUPPORTED_CHAINS: ChainConfig[] = [
  {
    id: 1,
    name: "Ethereum",
    icon: "/chains/ethereum-eth chain.svg",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  },
  {
    id: 56,
    name: "BNB Chain",
    icon: "/chains/BNB Chain.svg",
    nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
  },
];

export const DEFAULT_CHAIN_ID = 1;

// ========================================
// ERC20 ABI
// ========================================
export const ERC20_ABI = [
  {
    inputs: [
      { internalType: "address", name: "spender", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "owner", type: "address" },
      { internalType: "address", name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// ========================================
// ETHEREUM TOKENS
// ========================================
export const ETHEREUM_TOKENS: Record<string, EVMToken> = {
  ETH: createEVMToken(
    ChainId.MAINNET,
    "0x0000000000000000000000000000000000000000",
    18,
    "ETH",
    "Ether"
  ),
  USDC: createEVMToken(
    ChainId.MAINNET,
    "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    6,
    "USDC",
    "USD Coin"
  ),
  USDT: createEVMToken(
    ChainId.MAINNET,
    "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    6,
    "USDT",
    "Tether USD"
  ),
  // Ondo Tokenized Stocks
  NVDAon: createEVMToken(
    ChainId.MAINNET,
    "0x2d1f7226bd1f780af6b9a49dcc0ae00e8df4bdee",
    18,
    "NVDAon",
    "NVIDIA (Ondo Tokenized Stock)"
  ),
  TSLAon: createEVMToken(
    ChainId.MAINNET,
    "0xf6b1117ec07684d3958cad8beb1b302bfd21103f",
    18,
    "TSLAon",
    "Tesla (Ondo Tokenized Stock)"
  ),
  AAPLon: createEVMToken(
    ChainId.MAINNET,
    "0x14c3abf95cb9c93a8b82c1cdcb76d72cb87b2d4c",
    18,
    "AAPLon",
    "Apple (Ondo Tokenized Stock)"
  ),
  MSFTon: createEVMToken(
    ChainId.MAINNET,
    "0xb812837b81a3a6b81d7cd74cfb19a7f2784555e5",
    18,
    "MSFTon",
    "Microsoft (Ondo Tokenized Stock)"
  ),
  AMZNon: createEVMToken(
    ChainId.MAINNET,
    "0xbb8774fb97436d23d74c1b882e8e9a69322cfd31",
    18,
    "AMZNon",
    "Amazon (Ondo Tokenized Stock)"
  ),
  METAon: createEVMToken(
    ChainId.MAINNET,
    "0x59644165402b611b350645555b50afb581c71eb2",
    18,
    "METAon",
    "Meta Platforms (Ondo Tokenized Stock)"
  ),
  SPOTon: createEVMToken(
    ChainId.MAINNET,
    "0x590f21186489ca1612f49a4b1ff5c66acd6796a9",
    18,
    "SPOTon",
    "Spotify (Ondo Tokenized Stock)"
  ),
  SHOPon: createEVMToken(
    ChainId.MAINNET,
    "0x908266c1192628371cff7ad2f5eba4de061a0ac5",
    18,
    "SHOPon",
    "Shopify (Ondo Tokenized Stock)"
  ),
  MAon: createEVMToken(
    ChainId.MAINNET,
    "0xa29dc2102dfc2a0a4a5dcb84af984315567c9858",
    18,
    "MAon",
    "Mastercard (Ondo Tokenized Stock)"
  ),
  NFLXon: createEVMToken(
    ChainId.MAINNET,
    "0x032dec3372f25c41ea8054b4987a7c4832cdb338",
    18,
    "NFLXon",
    "Netflix (Ondo Tokenized Stock)"
  ),
};

// ========================================
// BNB CHAIN TOKENS
// ========================================
export const BNB_TOKENS: Record<string, EVMToken> = {
  BNB: createEVMToken(
    ChainId.BNB,
    "0x0000000000000000000000000000000000000000",
    18,
    "BNB",
    "BNB"
  ),
  USDC: createEVMToken(
    ChainId.BNB,
    "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
    18,
    "USDC",
    "USD Coin"
  ),
  USDT: createEVMToken(
    ChainId.BNB,
    "0x55d398326f99059fF775485246999027B3197955",
    18,
    "USDT",
    "Tether USD"
  ),
  // Ondo Tokenized Stocks
  NVDAon: createEVMToken(
    ChainId.BNB,
    "0xa9ee28c80f960b889dfbd1902055218cba016f75",
    18,
    "NVDAon",
    "NVIDIA (Ondo Tokenized Stock)"
  ),
  TSLAon: createEVMToken(
    ChainId.BNB,
    "0x2494b603319d4d9f9715c9f4496d9e0364b59d93",
    18,
    "TSLAon",
    "Tesla (Ondo Tokenized Stock)"
  ),
  AAPLon: createEVMToken(
    ChainId.BNB,
    "0x390a684ef9cade28a7ad0dfa61ab1eb3842618c4",
    18,
    "AAPLon",
    "Apple (Ondo Tokenized Stock)"
  ),
  MSFTon: createEVMToken(
    ChainId.BNB,
    "0x6bfe75d1ad432050ea973c3a3dcd88f02e2444c3",
    18,
    "MSFTon",
    "Microsoft (Ondo Tokenized Stock)"
  ),
  AMZNon: createEVMToken(
    ChainId.BNB,
    "0x4553cfe1c09f37f38b12dc509f676964e392f8fc",
    18,
    "AMZNon",
    "Amazon (Ondo Tokenized Stock)"
  ),
  METAon: createEVMToken(
    ChainId.BNB,
    "0xd7df5863a3e742f0c767768cdfcb63f09e0422f6",
    18,
    "METAon",
    "Meta Platforms (Ondo Tokenized Stock)"
  ),
  SPOTon: createEVMToken(
    ChainId.BNB,
    "0x50356167a4dbc38bea6779c045e24e25facedfdc",
    18,
    "SPOTon",
    "Spotify (Ondo Tokenized Stock)"
  ),
  SHOPon: createEVMToken(
    ChainId.BNB,
    "0x43d0b380c33cd004a6a69abd61843881a2de4113",
    18,
    "SHOPon",
    "Shopify (Ondo Tokenized Stock)"
  ),
  MAon: createEVMToken(
    ChainId.BNB,
    "0x25ffda07f585c39848db6573e533d7585679c52d",
    18,
    "MAon",
    "Mastercard (Ondo Tokenized Stock)"
  ),
  NFLXon: createEVMToken(
    ChainId.BNB,
    "0x7048f5227b032326cc8dbc53cf3fddd947a2c757",
    18,
    "NFLXon",
    "Netflix (Ondo Tokenized Stock)"
  ),
};

// ========================================
// MULTI-CHAIN ACCESS
// ========================================
export const EVM_TOKENS_BY_CHAIN: Record<number, Record<string, EVMToken>> = {
  1: ETHEREUM_TOKENS,
  56: BNB_TOKENS,
};

// Helper to get tokens for a specific chain
export const getTokensForChain = (
  chainId: number
): Record<string, EVMToken> => {
  return EVM_TOKENS_BY_CHAIN[chainId] || ETHEREUM_TOKENS;
};

export const EVM_TOKENS = ETHEREUM_TOKENS;

// ========================================
// TOKEN ICONS
// ========================================
export const TOKEN_ICONS: Record<string, string> = {
  // Native tokens
  ETH: "/crypto/svg/ethereum-eth-logo.svg",
  BNB: "/crypto/svg/BNB.svg",
  // Stablecoins
  USDC: "/crypto/svg/USDC.svg",
  USDT: "/crypto/svg/USDT.svg",
  // Ondo Tokenized Stocks
  NVDAon: "/stocks/svg/NVDAON.svg",
  TSLAon: "/stocks/svg/TSLAON.svg",
  AAPLon: "/stocks/svg/AAPLON.svg",
  MSFTon: "/stocks/svg/MSFTON.svg",
  AMZNon: "/stocks/svg/AMZNON.svg",
  METAon: "/stocks/svg/METAON.svg",
  SPOTon: "/stocks/svg/SPOTON.svg",
  SHOPon: "/stocks/svg/SHOPON.svg",
  MAon: "/stocks/svg/MAON.svg",
  NFLXon: "/stocks/svg/NFLXON.svg",
};
