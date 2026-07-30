import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const TESTNET_ENV = {
  NEXT_PUBLIC_STELLAR_NETWORK: "TESTNET",
  NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
  NEXT_PUBLIC_STELLAR_RPC_URL: "https://soroban-testnet.stellar.org",
  NEXT_PUBLIC_STELLAR_HORIZON_URL: "https://horizon-testnet.stellar.org",
} as const;

const EXPECTED_TESTNET = {
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

function stubStellarEnv(
  overrides: Partial<Record<keyof typeof TESTNET_ENV, string>> = {}
) {
  for (const [key, value] of Object.entries({ ...TESTNET_ENV, ...overrides })) {
    vi.stubEnv(key, value);
  }
}

describe("contractsByNetwork", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("resolves testnet protocol contracts", async () => {
    stubStellarEnv();
    const { getContracts } = await import("../contractsByNetwork");
    expect(getContracts()).toEqual(EXPECTED_TESTNET);
  });

  it("resolves standalone via LOCAL network", async () => {
    stubStellarEnv({
      NEXT_PUBLIC_STELLAR_NETWORK: "LOCAL",
    });
    const { getContracts } = await import("../contractsByNetwork");
    expect(getContracts()).toEqual(EXPECTED_TESTNET);
  });

  it("resolves standalone via STANDALONE network", async () => {
    stubStellarEnv({
      NEXT_PUBLIC_STELLAR_NETWORK: "STANDALONE",
    });
    const { getContracts } = await import("../contractsByNetwork");
    expect(getContracts()).toEqual(EXPECTED_TESTNET);
  });

  it("throws for PUBLIC when mainnet is not configured", async () => {
    stubStellarEnv({
      NEXT_PUBLIC_STELLAR_NETWORK: "PUBLIC",
      NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE:
        "Public Global Stellar Network ; September 2015",
      NEXT_PUBLIC_STELLAR_RPC_URL: "https://rpc.stellar.org",
      NEXT_PUBLIC_STELLAR_HORIZON_URL: "https://horizon.stellar.org",
    });
    const { getContracts } = await import("../contractsByNetwork");
    expect(() => getContracts()).toThrow(
      /No protocol contracts configured for network "mainnet"/
    );
  });

  it("FUTURENET falls back to testnet contracts (matches assets.config)", async () => {
    stubStellarEnv({
      NEXT_PUBLIC_STELLAR_NETWORK: "FUTURENET",
      NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE:
        "Test SDF Future Network ; October 2022",
      NEXT_PUBLIC_STELLAR_RPC_URL: "https://rpc-futurenet.stellar.org",
      NEXT_PUBLIC_STELLAR_HORIZON_URL: "https://horizon-futurenet.stellar.org",
    });
    const { getContracts } = await import("../contractsByNetwork");
    expect(getContracts()).toEqual(EXPECTED_TESTNET);
  });

  it("shares network id with getAssetsConfig", async () => {
    stubStellarEnv();
    const { getCurrentNetworkId } = await import("../assets.config");
    const { getContracts } = await import("../contractsByNetwork");
    expect(getCurrentNetworkId()).toBe("testnet");
    expect(getContracts().lendingPool1).toBe(EXPECTED_TESTNET.lendingPool1);
  });

  it("getLendingPoolContractId routes pool2 assets", async () => {
    stubStellarEnv();
    const { getLendingPoolContractId } = await import(
      "../contractsByNetwork"
    );
    expect(getLendingPoolContractId("CETES")).toBe(
      EXPECTED_TESTNET.lendingPool2
    );
    expect(getLendingPoolContractId("USDC")).toBe(
      EXPECTED_TESTNET.lendingPool1
    );
  });
});
