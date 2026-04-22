"use client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { ListedAsset } from "@/types";

interface AssetCardProps {
  asset: ListedAsset;
  onBuy: (a: ListedAsset) => void;
}

function truncate(addr: string) {
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

export function AssetCard({ asset, onBuy }: AssetCardProps) {
  return (
    <Card className="flex flex-col gap-4 p-5">
      <div>
        <h3 className="text-base font-semibold">{asset.name}</h3>
        <p className="text-xs text-white/50">
          {asset.symbol} · {truncate(asset.contractId)}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-md border border-white/10 bg-white/5 p-3 text-xs">
        <div>
          <p className="text-white/50">Price</p>
          <p className="font-medium">{asset.priceXlm} XLM</p>
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
