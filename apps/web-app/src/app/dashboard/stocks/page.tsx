import type { Metadata } from "next";
import Oracle from "@/features/stocks/components/pages/Oracle";

export const metadata: Metadata = {
  title: "Stocks | Neko Protocol",
  description: "View RWA stock prices and oracle data on Neko Protocol.",
};

export default function StocksPage() {
  return <Oracle />;
}
