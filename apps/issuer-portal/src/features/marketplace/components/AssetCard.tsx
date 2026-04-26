"use client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { STELLAR_EXPERT_TESTNET } from "@/lib/constants";
import { usePricePreview } from "@/features/marketplace/hooks/usePricePreview";
import type { ListedAsset } from "@/types";

interface AssetCardProps {
  asset: ListedAsset;
  onBuy: (a: ListedAsset) => void;
}

function truncate(addr: string) {
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

export function AssetCard({ asset, onBuy }: AssetCardProps) {
  const { data: price, isLoading: priceLoading } = usePricePreview(asset);
  const isOracle = asset.pricing.type === "oracle";

  const priceLabel = price
    ? `${price.pricePerTokenXlm.toLocaleString(undefined, {
        maximumFractionDigits: 7,
      })} XLM`
    : priceLoading
      ? "…"
      : isOracle
        ? "live (unavailable)"
        : "—";

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold">{asset.name}</h3>
          <p className="text-xs text-white/50">
            {asset.symbol} · {truncate(asset.contractId)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {isOracle ? (
            <span className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
              Live · Reflector
            </span>
          ) : null}
          <a
            href={`${STELLAR_EXPERT_TESTNET}/account/${asset.escrowAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/60 hover:text-white"
          >
            Escrow · TW
          </a>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-md border border-white/10 bg-white/5 p-3 text-xs">
        <div>
          <p className="text-white/50">Price</p>
          <p className="font-medium">{priceLabel}</p>
        </div>
        <div>
          <p className="text-white/50">Listed</p>
          <p className="font-medium">
            {Number(asset.listedAmount).toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-white/50">Decimals</p>
          <p className="font-medium">{asset.decimals}</p>
        </div>
        <div>
          <p className="text-white/50">Issuer</p>
          <p className="font-medium">
            {asset.issuerAddress ? truncate(asset.issuerAddress) : "—"}
          </p>
        </div>
      </div>

      <Button onClick={() => onBuy(asset)} className="mt-auto">
        Buy
      </Button>
    </Card>
  );
}
