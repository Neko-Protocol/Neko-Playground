import { getCurrentNetworkId } from "@/lib/constants/assets.config";

type NetworkId = "testnet" | "standalone" | "mainnet";

export interface ProtocolContracts {
  lending: string;
  lendingPool1: string;
  lendingPool2: string;
  oracle: string;
  backstop: string;
  backstopPool2: string;
  vault: string;
  nativeWrapper: string;
  strategies: { neko: string; aquarius: string; soroswap: string };
  vaultPools: { neko: string; aquarius: string; soroswap: string };
  blendPools: string[];
}

const TESTNET_CONTRACTS: ProtocolContracts = {
  lending: "CAPTJPAXEURYXEWGDSCCU3SZDYIP3U7KTS7VQM2EYLLK2JKIR4JIVWIH",
  lendingPool1: "CAPTJPAXEURYXEWGDSCCU3SZDYIP3U7KTS7VQM2EYLLK2JKIR4JIVWIH",
  lendingPool2: "CD3HUT3N6LLUS4XZUWRIIJZUKN2B3UDDMEH2IMK6S3UKAHTZ6VKKBTYQ",
  oracle: "CDJVAFSJTERWPYEZQJGN2N5N4BMXGMG6A2AWQK4C3V36MRYB4PRSNM2S",
  backstop: "CCSNXCONDIFZADRJZZRHMRXDGTC6EMI7ZAYAJPJMXSDHBMOPBLBX5XQX",
  backstopPool2: "CADKADCLXIZTU7Q3WS5M37HUF5BX3WCSTCM2ESN2JCJK5FBBH57FKSAV",
  vault: "CBHGX6TCHHVYJ7P3UZS7WI5TRAAA7GQA2L2Y7P2LCPIXWWD5FKDF2Z5S",
  nativeWrapper:
    "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
  vaultPools: {
    neko: "CB4HAFD6ECCOQZXOD6FXUVDM3E773LKR5JHVGA3DBJXIWHZUWX2THEDJ",
    aquarius: "CBJPT2SCZSUJQGBZHHCHLZJX3GVYLOPVUKF53ESH4NFQZMC2UFPDWHRI",
    soroswap: "CD2TAYCQZEY7U5CTUOV5QSGWHJNN4ZRPRUSMN2KRM2ZE6ZGX5TNU76H2",
  },
  strategies: {
    neko: "CCCEWBCYSIHTGBJ2TUOAFQY63UJ4SWDYTYNAEGXWPB7FP6PRHHGVZJIR",
    aquarius: "CCGV5QSAFRT6OGBZNCE72I6BAODXLDMWEUYAOBI5ZBLHOURSEGVGFTTZ",
    soroswap: "CCY5WW3VXVJDBBXNYXCCH33XTQICHPU6RPFWYJJCT4PTYPN3SXJN2XBJ",
  },
  blendPools: ["CCEBVDYM32YNYCVNRXQKDFFPISJJCV557CDZEIRBEE4NCV4KHPQ44HGF"],
};

const CONTRACTS_BY_NETWORK: Partial<Record<NetworkId, ProtocolContracts>> = {
  testnet: TESTNET_CONTRACTS,
  standalone: TESTNET_CONTRACTS,
  // mainnet: intentionally omitted until contracts are deployed on mainnet
};

const POOL2_ASSETS = new Set([
  "USTRY",
  "TESOURO",
  "CETES",
  "USDY",
  "PYUSD",
  "KTB",
]);

/**
 * Resolve the lending pool contract for an asset code.
 * Pool 1: RWA collateral → borrow USDC/XLM. Pool 2: USDC/XLM collateral → borrow RWA.
 */
export function getLendingPoolContractId(assetCode: string): string {
  const contracts = getContracts();
  return POOL2_ASSETS.has(assetCode)
    ? contracts.lendingPool2
    : contracts.lendingPool1;
}

/**
 * Resolve the protocol contract set for the configured network.
 *
 * Throws when the selected network has no contract set. This is deliberate:
 * silently falling back to testnet IDs on mainnet is how real value gets
 * sent to an address that means nothing on the target network.
 */
export function getContracts(): ProtocolContracts {
  const networkId = getCurrentNetworkId();
  const contracts = CONTRACTS_BY_NETWORK[networkId];
  if (!contracts) {
    throw new Error(
      `No protocol contracts configured for network "${networkId}".\n` +
        `Deploy the contracts and add a "${networkId}" entry to ` +
        `CONTRACTS_BY_NETWORK in lib/constants/contractsByNetwork.ts.`
    );
  }
  return contracts;
}
