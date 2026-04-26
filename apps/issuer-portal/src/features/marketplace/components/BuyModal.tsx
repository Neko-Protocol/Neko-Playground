"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { KycGate } from "@/features/marketplace/components/KycGate";
import { useBuyAsset } from "@/features/marketplace/hooks/useBuyAsset";
import { usePricePreview } from "@/features/marketplace/hooks/usePricePreview";
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
  const [slippage, setSlippage] = useState("1"); // %
  const { data: price, isLoading: priceLoading } = usePricePreview(asset);
  const { mutateAsync, isPending, error } = useBuyAsset();
  const [result, setResult] = useState<{
    buyHash: string;
    releaseTx: string;
    mockRelease: boolean;
  } | null>(null);

  const totalXlm = price ? Number(amount) * price.pricePerTokenXlm : null;

  const maxPriceStroops = useMemo(() => {
    if (!price) return 0n;
    if (asset.pricing.type === "fixed") return price.pricePerTokenStroops;
    const slippagePct = Math.max(0, Number(slippage) || 0);
    const numerator = 10_000n + BigInt(Math.round(slippagePct * 100));
    return (price.pricePerTokenStroops * numerator) / 10_000n;
  }, [price, slippage, asset.pricing.type]);

  const handleBuy = async () => {
    if (!price || maxPriceStroops <= 0n) return;
    try {
      const res = await mutateAsync({
        asset,
        tokenAmount: amount,
        maxPricePerTokenStroops: maxPriceStroops,
      });
      setResult(res);
      setStage("done");
    } catch {
      /* surfaced inline */
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

            {asset.pricing.type === "oracle" ? (
              <Input
                label="Max slippage (%)"
                type="number"
                min={0}
                step="0.1"
                value={slippage}
                onChange={(e) => setSlippage(e.target.value)}
                hint="Buy fails if the price moves above this before mining."
              />
            ) : null}

            <div className="rounded-md border border-white/10 bg-white/5 p-3 text-sm space-y-1.5">
              <div className="flex justify-between">
                <span className="text-white/50">
                  Price / token{" "}
                  {asset.pricing.type === "oracle" ? "(live)" : null}
                </span>
                <span>
                  {price
                    ? `${price.pricePerTokenXlm.toLocaleString(undefined, {
                        maximumFractionDigits: 7,
                      })} XLM`
                    : priceLoading
                      ? "…"
                      : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Est. total</span>
                <span className="font-medium">
                  {totalXlm !== null
                    ? `${totalXlm.toLocaleString(undefined, {
                        maximumFractionDigits: 4,
                      })} XLM`
                    : "—"}
                </span>
              </div>
              {asset.pricing.type === "oracle" ? (
                <div className="flex justify-between text-xs text-white/40">
                  <span>Max price / token</span>
                  <span>
                    {(Number(maxPriceStroops) / 10_000_000).toLocaleString(
                      undefined,
                      { maximumFractionDigits: 7 }
                    )}{" "}
                    XLM
                  </span>
                </div>
              ) : null}
            </div>

            {error ? (
              <p className="text-sm text-red-400">{(error as Error).message}</p>
            ) : null}

            <div className="flex gap-2">
              <Button
                onClick={handleBuy}
                loading={isPending}
                className="flex-1"
                disabled={!price || isPending}
              >
                {isPending ? "Signing…" : "Sign & buy"}
              </Button>
              <Button variant="secondary" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </div>
        ) : result ? (
          <div className="space-y-4">
            <p className="text-sm text-white/70">
              Purchase complete. Tokens have been delivered to your wallet
              {result.mockRelease
                ? " (via mock TW release)"
                : " by Trustless Work"}
              .
            </p>
            <div className="space-y-2 rounded-md border border-white/10 bg-white/5 p-3 text-xs">
              <a
                className="flex justify-between text-neko-teal"
                href={`${STELLAR_EXPERT_TESTNET}/tx/${result.buyHash}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="text-white/50">Buy</span>
                <span className="truncate">{result.buyHash}</span>
              </a>
              <a
                className="flex justify-between text-neko-teal"
                href={`${STELLAR_EXPERT_TESTNET}/tx/${result.releaseTx}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="text-white/50">Release</span>
                <span className="truncate">{result.releaseTx}</span>
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
