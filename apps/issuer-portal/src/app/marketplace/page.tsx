"use client";

import { useState } from "react";
import { AssetCard } from "@/features/marketplace/components/AssetCard";
import { BuyModal } from "@/features/marketplace/components/BuyModal";
import { usePortalStore } from "@/stores/portal.store";
import type { ListedAsset } from "@/types";

export default function MarketplacePage() {
  const assets = usePortalStore((s) => s.assets);
  const [active, setActive] = useState<ListedAsset | null>(null);

  return (
    <div className="mx-auto max-w-6xl px-6 py-12 space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">Marketplace</h1>
        <p className="text-sm text-white/60">
          Assets distributed through Neko. Buyers must complete KYC before
          purchasing.
        </p>
      </header>

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
