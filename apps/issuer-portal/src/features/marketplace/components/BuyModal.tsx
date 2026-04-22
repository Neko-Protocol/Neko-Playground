"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { KycGate } from "@/features/marketplace/components/KycGate";
import { useBuyAsset } from "@/features/marketplace/hooks/useBuyAsset";
import { STELLAR_EXPERT_TESTNET } from "@/lib/constants";
import { cn } from "@/lib/cn";
import type { ListedAsset } from "@/types";

interface BuyModalProps {
  asset: ListedAsset | null;
  onClose: () => void;
}

export function BuyModal({ asset, onClose }: BuyModalProps) {
  if (!asset) return null;
  return (
    <BuyModalInner key={asset.contractId} asset={asset} onClose={onClose} />
  );
}

function BuyModalInner({
  asset,
  onClose,
}: {
  asset: ListedAsset;
  onClose: () => void;
}) {
  const [stage, setStage] = useState<"gate" | "form" | "done">("gate");
  const [amount, setAmount] = useState("1");
  const { mutateAsync, isPending, error } = useBuyAsset();
  const [result, setResult] = useState<{
    approveHash: string;
    buyHash: string;
  } | null>(null);

  const total = Number(amount) * asset.priceXlm;

  const handleBuy = async () => {
    try {
      const res = await mutateAsync({ asset, tokenAmount: amount });
      setResult(res);
      setStage("done");
    } catch {
      /* error shown inline */
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div
        className={cn(
          "w-full max-w-lg rounded-xl border border-white/10 bg-neutral-950 p-6 shadow-xl",
          "max-h-[90vh] overflow-y-auto"
        )}
      >
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold">Buy {asset.symbol}</h2>
            <p className="text-xs text-white/50">{asset.name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {stage === "gate" ? (
          <KycGate onApproved={() => setStage("form")} />
        ) : stage === "form" ? (
          <div className="space-y-5">
            <Input
              label={`Amount (${asset.symbol})`}
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <div className="rounded-md border border-white/10 bg-white/5 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-white/50">Price / token</span>
                <span>{asset.priceXlm} XLM</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Total</span>
                <span className="font-medium">{total} XLM</span>
              </div>
            </div>

            {error ? (
              <p className="text-sm text-red-400">{(error as Error).message}</p>
            ) : null}

            <div className="flex gap-2">
              <Button
                onClick={handleBuy}
                loading={isPending}
                className="flex-1"
              >
                {isPending ? "Signing…" : "Approve & buy"}
              </Button>
              <Button variant="secondary" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </div>
        ) : result ? (
          <div className="space-y-4">
            <p className="text-sm text-white/70">
              Purchase complete. Tokens have been delivered to your wallet.
            </p>
            <div className="space-y-2 rounded-md border border-white/10 bg-white/5 p-3 text-xs">
              <a
                className="flex justify-between text-neko-teal"
                href={`${STELLAR_EXPERT_TESTNET}/tx/${result.approveHash}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="text-white/50">Approve</span>
                <span className="truncate">{result.approveHash}</span>
              </a>
              <a
                className="flex justify-between text-neko-teal"
                href={`${STELLAR_EXPERT_TESTNET}/tx/${result.buyHash}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="text-white/50">Buy</span>
                <span className="truncate">{result.buyHash}</span>
              </a>
            </div>
            <Button onClick={onClose} className="w-full">
              Done
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
