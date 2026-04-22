"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useWallet } from "@/hooks/useWallet";
import { fetchTokenMetadata } from "@/lib/stellar/contract";

export interface LinkTokenValues {
  contractId: string;
  name: string;
  symbol: string;
  decimals: number;
}

interface LinkTokenStepProps {
  onLinked: (v: LinkTokenValues) => void;
}

const CONTRACT_ID_RE = /^C[A-Z2-7]{55}$/;

export function LinkTokenStep({ onLinked }: LinkTokenStepProps) {
  const { address } = useWallet();
  const [contractId, setContractId] = useState("");
  const [metadata, setMetadata] = useState<LinkTokenValues | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!address) {
    return (
      <Card className="p-8 text-sm text-white/60">
        Connect your wallet to link a token.
      </Card>
    );
  }

  const validate = async () => {
    setError(null);
    setMetadata(null);
    const trimmed = contractId.trim();
    if (!CONTRACT_ID_RE.test(trimmed)) {
      setError(
        'Invalid contract ID. Must start with "C" and be 56 characters long.'
      );
      return;
    }
    setIsValidating(true);
    try {
      const meta = await fetchTokenMetadata(address, trimmed);
      setMetadata({ contractId: trimmed, ...meta });
    } catch (e) {
      setError(
        (e as Error).message.includes("simulate")
          ? "This contract doesn't expose name()/symbol()/decimals(). Make sure it's a SEP-41 token."
          : (e as Error).message
      );
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 space-y-5">
        <div>
          <h3 className="text-lg font-semibold">Link your token</h3>
          <p className="text-sm text-white/60">
            Paste the contract ID of the token you already deployed. We&apos;ll
            auto-detect its name, symbol and decimals.
          </p>
        </div>

        <div className="space-y-3">
          <Input
            label="Token contract ID"
            placeholder="C..."
            value={contractId}
            onChange={(e) => {
              setContractId(e.target.value);
              setMetadata(null);
            }}
            onBlur={() => {
              if (contractId.trim() && !metadata) void validate();
            }}
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
          />
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={validate}
              loading={isValidating}
              disabled={!contractId.trim()}
            >
              Validate
            </Button>
            {error ? <p className="text-xs text-red-400">{error}</p> : null}
          </div>
        </div>
      </Card>

      {metadata ? (
        <Card className="p-6 space-y-4">
          <h4 className="text-sm font-semibold text-white/80">
            Detected metadata
          </h4>
          <div className="grid gap-3 rounded-md border border-white/10 bg-white/5 p-4 text-sm">
            <Row label="Name" value={metadata.name} />
            <Row label="Symbol" value={metadata.symbol} />
            <Row label="Decimals" value={metadata.decimals.toString()} />
          </div>
          <Button onClick={() => onLinked(metadata)}>Continue</Button>
        </Card>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-white/50">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
