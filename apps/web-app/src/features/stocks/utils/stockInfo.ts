import type { StockInfo } from "../types/stocks";

export const STOCK_INFO: Record<string, StockInfo> = {
  NVDA: {
    logo: "/stocks/nvda.png",
    name: "NVIDIA Corporation",
    description: "Leader in GPU technology and AI computing platforms",
  },
  AAPL: {
    logo: "/stocks/aapl.png",
    name: "Apple Inc.",
    description:
      "Technology company specializing in consumer electronics and software",
  },
  PLTR: {
    logo: "/stocks/pltr.png",
    name: "Palantir Technologies",
    description:
      "Data analytics and software company for large-scale data integration",
  },
  TSLA: {
    logo: "/stocks/tsla.png",
    name: "Tesla, Inc.",
    description: "Electric vehicle and clean energy company",
  },
  META: {
    logo: "/stocks/meta.png",
    name: "Meta Platforms Inc.",
    description:
      "Social media and technology company focused on virtual and augmented reality",
  },
  MSFT: {
    logo: "/stocks/msft.png",
    name: "Microsoft Corporation",
    description:
      "Technology corporation developing computer software, consumer electronics, and cloud services",
  },
};
