/**
 * Utility functions for swap operations
 */

import { getAvailableTokens } from "./soroswap";

/**
 * Format amount based on token decimals
 */
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
 * Convert amount to smallest unit (stroops for XLM, smallest unit for tokens)
 */
export const toSmallestUnit = (
  amount: string | number,
  decimals: number = 7
): string => {
  const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(numAmount)) return "0";

  const multiplier = Math.pow(10, decimals);
  const result = Math.floor(numAmount * multiplier).toString();
  return result;
};

/**
 * Convert from smallest unit to human-readable format
 */
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

/**
 * Get token display name
 */
export const getTokenDisplayName = (
  token:
    | { type: "native" | "contract"; code?: string; contract?: string }
    | string
): string => {
  if (typeof token === "string") {
    // Token is a contract address string
    // Compare with known addresses from Soroswap
    if (token === "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC") {
      return "XLM";
    }
    if (token === "CBBHRKEP5M3NUDRISGLJKGHDHX3DA2CN2AZBQY6WLVUJ7VNLGSKBDUCM") {
      return "USDC";
    }
    return "Token";
  }

  if (token.type === "native") {
    return "XLM";
  }
  return token.code || "Token";
};

/**
 * Get explorer URL for a transaction
 */
export const getExplorerUrl = (txHash: string, network?: string): string => {
  const networkParam = network === "PUBLIC" ? "" : `/${network?.toLowerCase()}`;
  return `https://stellar.expert/explorer${networkParam}/tx/${txHash}`;
};

/**
 * Mapping of EVM token addresses to their symbols
 */
const EVM_TOKEN_ADDRESS_TO_SYMBOL: Record<string, string> = {
  // Ethereum
  "0x0000000000000000000000000000000000000000": "ETH",
  "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee": "ETH",
  "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": "ETH",
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": "USDC",
  "0xdac17f958d2ee523a2206206994597c13d831ec7": "USDT",
  "0x2d1f7226bd1f780af6b9a49dcc0ae00e8df4bdee": "NVDAon",
  "0xf6b1117ec07684d3958cad8beb1b302bfd21103f": "TSLAon",
  "0x14c3abf95cb9c93a8b82c1cdcb76d72cb87b2d4c": "AAPLon",
  "0xb812837b81a3a6b81d7cd74cfb19a7f2784555e5": "MSFTon",
  "0xbb8774fb97436d23d74c1b882e8e9a69322cfd31": "AMZNon",
  "0x59644165402b611b350645555b50afb581c71eb2": "METAon",
  "0x590f21186489ca1612f49a4b1ff5c66acd6796a9": "SPOTon",
  "0x908266c1192628371cff7ad2f5eba4de061a0ac5": "SHOPon",
  "0xa29dc2102dfc2a0a4a5dcb84af984315567c9858": "MAon",
  "0x032dec3372f25c41ea8054b4987a7c4832cdb338": "NFLXon",
  // BNB Chain
  "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c": "BNB",
  "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d": "USDC",
  "0x55d398326f99059ff775485246999027b3197955": "USDT",
  "0xa9ee28c80f960b889dfbd1902055218cba016f75": "NVDAon",
  "0x2494b603319d4d9f9715c9f4496d9e0364b59d93": "TSLAon",
  "0x390a684ef9cade28a7ad0dfa61ab1eb3842618c4": "AAPLon",
  "0x6bfe75d1ad432050ea973c3a3dcd88f02e2444c3": "MSFTon",
  "0x4553cfe1c09f37f38b12dc509f676964e392f8fc": "AMZNon",
  "0xd7df5863a3e742f0c767768cdfcb63f09e0422f6": "METAon",
  "0x50356167a4dbc38bea6779c045e24e25facedfdc": "SPOTon",
  "0x43d0b380c33cd004a6a69abd61843881a2de4113": "SHOPon",
  "0x25ffda07f585c39848db6573e533d7585679c52d": "MAon",
  "0x7048f5227b032326cc8dbc53cf3fddd947a2c757": "NFLXon",
};

/**
 * Get token icon/image path based on token code or address
 */
export const getTokenIcon = (
  token:
    | { type: "native" | "contract"; code?: string; contract?: string }
    | string
    | { symbol?: string; address?: string }
): string | null => {
  let tokenCode: string | null = null;
  let isEVM = false;

  // Handle EVM token objects
  if (
    typeof token === "object" &&
    "symbol" in token &&
    "address" in token &&
    !("type" in token)
  ) {
    tokenCode = token.symbol || null;
    isEVM = true;
  } else if (typeof token === "string") {
    const addressLower = token.toLowerCase();
    // Check if it's an EVM address
    if (EVM_TOKEN_ADDRESS_TO_SYMBOL[addressLower]) {
      tokenCode = EVM_TOKEN_ADDRESS_TO_SYMBOL[addressLower];
      isEVM = true;
    }
    // Check if it's an EVM token symbol (exact match first, case-sensitive for Ondo tokens)
    else if (Object.values(EVM_TOKEN_ADDRESS_TO_SYMBOL).includes(token)) {
      tokenCode = token;
      isEVM = true;
    }
    // Check common EVM token symbols (case-insensitive)
    else if (["ETH", "BNB", "USDC", "USDT"].includes(token.toUpperCase())) {
      tokenCode = token.toUpperCase();
      isEVM = true;
    } else {
      // Check if it's a Stellar contract address
      try {
        const availableTokens = getAvailableTokens();
        // Find token code by contract address
        for (const [code, info] of Object.entries(availableTokens)) {
          if (info.contract === token) {
            tokenCode = code;
            isEVM = false;
            break;
          }
        }
      } catch {
        // Fallback to hardcoded addresses if getAvailableTokens fails
        const hardcodedMap: Record<string, string> = {
          CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC: "XLM", // testnet XLM
          CB3TLW74NBIOT3BUWOZ3TUM6RFDF6A4GVIRUQRQZABG5KPOUL4JJOV2F: "USDC", // testnet USDC
          CDMLFMKMMD7MWZP3FKUBZPVHTUEDLSX4BYGYKH4GCESXYHS3IHQ4EIG4: "XLM", // standalone XLM
          CAXPYMWLMZRSPNM6NE6DGIZRZABQ6TYQASARRJTOKIIJ3ZJCBFRAPW3F: "USDC", // standalone USDC
          CBTPNPK5HDORKWSOVM22FCJXDVAMRA6Y2J4COGFWAU7O6VHJ6PV2KSUY: "NVDA", // testnet NVDA
          CB7ICLBZWLGCULENOTKZAW57WDVM4A5ENFCQ7HRNW4S4SSPGAFY6T26P: "AAPL", // testnet AAPL
          CBDCAAID46PGO2BXPOCQJVODXGDNWYFUHCMRRHOP56PZZCOVAIOEGA3C: "PLTR", // testnet PLTR
          CANDL3RC3BWGGQEXIOH76ZFWOGPLCNXEUJG25BAQKCRN7WLXXXHUC35O: "TSLA", // testnet TSLA
          CAVCEHVJYV4R6LO3YXDOYHZJEPI4B4R4JUX4BLH4OBVNIFDWD77RSJLN: "META", // testnet META
        };
        tokenCode = hardcodedMap[token] || null;
        isEVM = false;
      }
      // If still no code found, assume it's a Stellar symbol
      if (!tokenCode) {
        tokenCode = token.toUpperCase();
        isEVM = false;
      }
    }
  } else if (typeof token === "object" && "type" in token) {
    // Stellar token object
    if (token.type === "native") {
      tokenCode = "XLM";
    } else {
      tokenCode = token.code || null;
    }
    isEVM = false;
  }

  if (!tokenCode) {
    return null;
  }

  if (isEVM) {
    // EVM tokens icon map
    const evmIconMap: Record<string, string> = {
      // Crypto tokens (EVM)
      ETH: "/crypto/svg/ethereum-eth-logo.svg",
      BNB: "/crypto/svg/BNB.svg",
      USDC: "/crypto/svg/USDC.svg",
      USDT: "/crypto/svg/USDT.svg",
      // Ondo Tokenized Stocks (EVM)
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
    return evmIconMap[tokenCode] || null;
  } else {
    // Stellar tokens icon map
    const stellarIconMap: Record<string, string> = {
      XLM: "/crypto/svg/stellar-xlm-logo.svg",
      USDC: "/crypto/png/usd-coin-usdc-logo.png",
      NVDA: "/stocks/nvda.png",
      AAPL: "/stocks/aapl.png",
      PLTR: "/stocks/pltr.png",
      TSLA: "/stocks/tsla.png",
      META: "/stocks/meta.png",
      MSFT: "/stocks/msft.png",
    };
    return stellarIconMap[tokenCode] || null;
  }
};
