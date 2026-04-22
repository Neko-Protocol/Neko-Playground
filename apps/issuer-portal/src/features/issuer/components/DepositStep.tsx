"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useWallet } from "@/hooks/useWallet";
import { fetchTokenBalance } from "@/lib/stellar/contract";
import { useListAsset } from "@/features/issuer/hooks/useListAsset";
import type { LinkTokenValues } from "@/features/issuer/components/LinkTokenStep";

interface DepositStepProps {
  token: LinkTokenValues;
  onListed: (res: {
    token: LinkTokenValues;
    listedAmount: string;
    priceXlm: string;
    listTx: string;
  }) => void;
}

function formatBalance(base: bigint, decimals: number): string {
  if (base === 0n) return "0";
  const s = base.toString().padStart(decimals + 1, "0");
  const whole = s.slice(0, -decimals) || "0";
  const frac = s.slice(-decimals).replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole;
}

export function DepositStep({ token, onListed }: DepositStepProps) {
  const { address } = useWallet();
  const { mutateAsync, isPending, error } = useListAsset();
  const [amount, setAmount] = useState("");
  const [priceXlm, setPriceXlm] = useState("");
  const [balance, setBalance] = useState<bigint | null>(null);
  const [balanceError, setBalanceError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    setBalance(null);
    setBalanceError(null);
    fetchTokenBalance(address, token.contractId, address)
      .then((b) => {
        if (!cancelled) setBalance(b);
      })
      .catch((e) => {
        if (!cancelled) setBalanceError((e as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, [address, token.contractId]);

  const handleList = async () => {
    try {
      const res = await mutateAsync({
        token,
        listedAmount: amount,
        priceXlm,
      });
      onListed({
        token,
        listedAmount: amount,
        priceXlm,
        listTx: res.listTx,
      });
    } catch {
      /* surfaced via error below */
    }
  };

  const balanceLabel =
    balance !== null
      ? `${formatBalance(balance, token.decimals)} ${token.symbol}`
      : balanceError
        ? "unavailable"
        : "…";

  const canSubmit = Number(amount) > 0 && Number(priceXlm) > 0 && !isPending;

  return (
    <Card className="p-8 space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Deposit liquidity</h3>
        <p className="text-sm text-white/60">
          Choose how much of {token.symbol} to deposit into the Neko distributor
          and at what price per token. The distributor will custody the tokens
          until buyers purchase.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Input
          label={`Amount to list (${token.symbol})`}
          type="number"
          min={0}
          step="any"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          hint={`Balance: ${balanceLabel}`}
          required
        />
        <Input
          label="Price per token (XLM)"
          type="number"
          min={0}
          step="0.0000001"
          value={priceXlm}
          onChange={(e) => setPriceXlm(e.target.value)}
          required
        />
      </div>

      <div className="grid gap-2 rounded-lg border border-white/10 bg-white/5 p-4 text-sm">
        <Row label="Token" value={`${token.name} (${token.symbol})`} />
        <Row label="Contract" value={token.contractId} className="truncate" />
        <Row
          label="Total raise (if fully sold)"
          value={
            Number(amount) > 0 && Number(priceXlm) > 0
              ? `${(Number(amount) * Number(priceXlm)).toLocaleString()} XLM`
              : "—"
          }
        />
      </div>

      {error ? (
        <p className="text-sm text-red-400">{(error as Error).message}</p>
      ) : null}

      <Button
        onClick={handleList}
        loading={isPending}
        size="lg"
        disabled={!canSubmit}
      >
        {isPending ? "Signing…" : "Sign and list"}
      </Button>

      <p className="text-xs text-white/40">
        You&apos;ll sign one transaction: the distributor pulls {token.symbol}{" "}
        from your wallet into escrow.
      </p>
    </Card>
  );
}

function Row({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-white/50 shrink-0">{label}</span>
      <span className={`font-medium text-right ${className ?? ""}`}>
        {value}
      </span>
    </div>
  );
}
