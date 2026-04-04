import type { Metadata } from "next";
import UnifiedPoolsPage from "@/features/pools/components/pages/UnifiedPoolsPage";

export const metadata: Metadata = {
  title: "Pools | Neko Protocol",
  description:
    "Supply liquidity, borrow assets, and manage your positions in Neko Protocol pools.",
};

export default function PoolsPage() {
  return <UnifiedPoolsPage />;
}
