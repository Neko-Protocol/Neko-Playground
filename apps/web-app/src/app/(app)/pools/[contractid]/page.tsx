import type { Metadata } from "next";
import PoolDetail from "@/features/pools/components/pages/PoolDetail";

export const metadata: Metadata = {
  title: "Pool Details | Neko Protocol",
  description: "View pool details, deposit, withdraw, and manage positions.",
};

export default function PoolDetailPage({
  params,
}: {
  params: Promise<{ contractid: string }>;
}) {
  return <PoolDetail params={params} />;
}
