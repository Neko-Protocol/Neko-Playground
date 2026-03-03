import type { StockInfo } from "../types/stocks";

export const STOCK_INFO: Record<string, StockInfo> = {
  USTRY: {
    logo: "/assets/ustry-logo.png",
    name: "US Treasury Token",
    description: "Tokenized US Treasury bonds providing stable yield",
  },
  TESOURO: {
    logo: "/assets/tesouro-logo.png",
    name: "Tesouro Token",
    description: "Tokenized Brazilian government bonds (Tesouro Direto)",
  },
  CETES: {
    logo: "/assets/cetes-logo.png",
    name: "CETES Token",
    description: "Tokenized Mexican government treasury certificates (CETES)",
  },
  USDY: {
    logo: "/assets/usdy-logo.png",
    name: "US Dollar Yield",
    description: "Yield-bearing stablecoin backed by US Treasury bills",
  },
  PYUSD: {
    logo: "/assets/pyusd-logo.png",
    name: "PayPal USD",
    description: "Stablecoin issued by PayPal, pegged to the US dollar",
  },
};
