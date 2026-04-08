import type { StockInfo } from "../types/stocks";

export const STOCK_INFO: Record<string, StockInfo> = {
  USTRY: {
    logo: "/assets/ustry-logo.png",
    name: "US Treasury Token",
    description: "Tokenized US Treasury bonds providing stable yield",
    summary:
      "USTRY represents US Treasury bonds on blockchain — government-backed debt that earns yield. It combines the security of traditional bonds with 24/7 trading and transparency. You can buy it on Etherfuse (Stellar, Solana, Base): use devnet.etherfuse.com to test or app.etherfuse.com for production.",
    buyInfo: {
      platform: "Etherfuse",
      url: "https://app.etherfuse.com",
    },
  },
  TESOURO: {
    logo: "/assets/tesouro-logo.png",
    name: "Tesouro Token",
    description: "Tokenized Brazilian government bonds (Tesouro Direto)",
    summary:
      "Tesouro represents Brazilian government bonds (Tesouro Direto) on blockchain — sovereign debt that earns yield with transparent, 24/7 access. Buy on Etherfuse via app.etherfuse.com or test at devnet.etherfuse.com.",
    buyInfo: {
      platform: "Etherfuse",
      url: "https://app.etherfuse.com",
    },
  },
  CETES: {
    logo: "/assets/cetes-logo.png",
    name: "CETES Token",
    description: "Tokenized Mexican government treasury certificates (CETES)",
    summary:
      "CETES tokens represent Mexican Treasury certificates on blockchain — government-backed certificates that earn yield with 24/7 trading. Buy on Etherfuse at app.etherfuse.com or test at devnet.etherfuse.com.",
    buyInfo: {
      platform: "Etherfuse",
      url: "https://app.etherfuse.com",
    },
  },
  USDY: {
    logo: "/assets/usdy-logo.png",
    name: "US Dollar Yield",
    description: "Yield-bearing stablecoin backed by US Treasury bills",
    summary:
      "USDY is Ondo Finance's yield-bearing stablecoin backed by US Treasuries and bank deposits (~5.3% APY). On Stellar you can buy it via Lobstr (swap), Soroswap, or anchors. Not available to US persons.",
    buyInfo: {
      platform: "Lobstr",
      url: "https://lobstr.co",
      description:
        "USDY on Stellar: Lobstr (swap/DEX), Soroswap, or Ondo anchors. Also on Bybit and Phemex. Not available to US persons.",
    },
  },
  PYUSD: {
    logo: "/assets/pyusd-logo.png",
    name: "PayPal USD",
    description: "Stablecoin issued by PayPal, pegged to the US dollar",
    summary:
      "PYUSD is PayPal's dollar-backed stablecoin (1:1 USD) issued by Paxos. On Stellar: Lobstr, Bitcoin.com, Chipper Cash, Decaf, Arculus, Meru, CiNKO, COCA. Also via PayPal and Venmo.",
    buyInfo: {
      platform: "Lobstr",
      url: "https://lobstr.co",
      description:
        "PYUSD on Stellar: Lobstr, Bitcoin.com, Chipper Cash, Decaf, Arculus, Meru, CiNKO, COCA. Also via PayPal and Venmo.",
    },
  },
  KTB: {
    logo: "/assets/ktb.png",
    name: "Korean Treasury Bond",
    description:
      "Tokenized Korean government bonds (KTBs) via Etherfuse and Shinhan Securities",
    summary:
      "KTB is an Etherfuse Stablebond backed by short-term Korean Treasury Bonds — South Korean sovereign debt that earns yield on-chain. Issued in partnership with Shinhan Securities, it provides transparent exposure to one of Asia's most stable government bond markets. Available on Stellar, Solana, Base, Polygon, and Monad. Buy on Etherfuse at app.etherfuse.com or test at devnet.etherfuse.com.",
    buyInfo: {
      platform: "Etherfuse",
      url: "https://app.etherfuse.com",
    },
  },
};
