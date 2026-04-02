import type { Metadata } from "next";
import Vault from "@/features/vault/components/pages/Vault";

export const metadata: Metadata = {
  title: "Vault | Neko Protocol",
  description:
    "Discover and deposit into Neko vaults. Real-time RWA price data and yield-generating strategies on Stellar.",
};

export default function VaultPage() {
  return <Vault />;
}
