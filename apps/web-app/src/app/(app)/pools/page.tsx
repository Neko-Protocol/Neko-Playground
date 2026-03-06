import type { Metadata } from "next";
import Pools from "@/features/pools/components/pages/Pools";

export const metadata: Metadata = {
  title: "Pools | Neko Protocol",
  description: "Explore and manage liquidity pools on Neko Protocol.",
};

export default function PoolsPage() {
  return <Pools />;
}
