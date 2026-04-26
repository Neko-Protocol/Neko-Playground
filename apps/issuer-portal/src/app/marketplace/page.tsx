"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { AssetCard } from "@/features/marketplace/components/AssetCard";
import { BuyModal } from "@/features/marketplace/components/BuyModal";
import { useKycStatus } from "@/hooks/useKyc";
import { useWallet } from "@/hooks/useWallet";
import { usePortalStore } from "@/stores/portal.store";
import type { ListedAsset } from "@/types";

export default function MarketplacePage() {
  const assets = usePortalStore((s) => s.assets);
  const [active, setActive] = useState<ListedAsset | null>(null);
  const search = useSearchParams();
  const { address } = useWallet();
  const { data: kyc } = useKycStatus(address);
  const kycReturnPending =
    search.get("kyc") === "pending" && Boolean(address) && !kyc;

  return (
    <div className="mx-auto max-w-6xl px-6 py-12 space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">Marketplace</h1>
        <p className="text-sm text-white/60">
          Assets distributed through Neko. Buyers must complete KYC before
          purchasing.
        </p>
      </header>

      {kycReturnPending ? (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Finishing verification… this page updates automatically. Open{" "}
          <strong>Buy</strong> again once you see your KYC as cleared.
        </div>
      ) : null}

      {assets.length === 0 ? (
        <div className="rounded-lg border border-dashed border-white/10 p-16 text-center text-sm text-white/50">
          No assets listed yet. Head to the issuer flow to list your first token
          for distribution.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {assets.map((a) => (
            <AssetCard key={a.contractId} asset={a} onBuy={setActive} />
          ))}
        </div>
      )}

      <BuyModal asset={active} onClose={() => setActive(null)} />
    </div>
  );
}
