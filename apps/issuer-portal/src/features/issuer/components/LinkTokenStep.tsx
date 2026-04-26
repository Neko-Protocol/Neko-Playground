"use client";

import { useState } from "react";
import { StrKey } from "@stellar/stellar-sdk";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useWallet } from "@/hooks/useWallet";
import {
  fetchTokenMetadata,
  resolveClassicIssuedAsset,
} from "@/lib/stellar/contract";

export interface LinkTokenValues {
  contractId: string;
  name: string;
  symbol: string;
  decimals: number;
  /** Set when linked via classic issuer + code; sent to TW as `trustline.issuer`. */
  classicIssuer?: string;
}

interface LinkTokenStepProps {
  onLinked: (v: LinkTokenValues) => void;
}

const CONTRACT_ID_RE = /^C[A-Z2-7]{55}$/;

type LinkMode = "classic" | "soroban";

export function LinkTokenStep({ onLinked }: LinkTokenStepProps) {
  const { address } = useWallet();
  const [mode, setMode] = useState<LinkMode>("classic");
  const [contractId, setContractId] = useState("");
  const [classicIssuer, setClassicIssuer] = useState("");
  const [classicCode, setClassicCode] = useState("");
  const [metadata, setMetadata] = useState<LinkTokenValues | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [classicLinkNote, setClassicLinkNote] = useState<string | null>(null);

  if (!address) {
    return (
      <Card className="p-8 text-sm text-white/60">
        Connect your wallet to link a token.
      </Card>
    );
  }

  const resetOutcome = () => {
    setError(null);
    setMetadata(null);
    setClassicLinkNote(null);
  };

  const setModeAndReset = (next: LinkMode) => {
    setMode(next);
    resetOutcome();
  };

  const validateSoroban = async () => {
    resetOutcome();
    const trimmed = contractId.trim();
    if (StrKey.isValidEd25519PublicKey(trimmed)) {
      setError(
        "That is a Stellar account (G…). Use “Issued asset” and enter issuer + asset code, or paste the Soroban token contract (C…)."
      );
      return;
    }
    if (!CONTRACT_ID_RE.test(trimmed)) {
      setError(
        'Invalid Soroban contract id. Must start with "C" and be 56 characters.'
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

  const validateClassic = async () => {
    resetOutcome();
    const issuer = classicIssuer.trim();
    const code = classicCode.trim();
    if (!issuer) {
      setError("Enter the asset issuer (Stellar G-address).");
      return;
    }
    if (!StrKey.isValidEd25519PublicKey(issuer)) {
      setError("Issuer must be a valid Stellar G-address.");
      return;
    }
    if (!code) {
      setError("Enter the asset code (e.g. NKB).");
      return;
    }
    setIsValidating(true);
    try {
      const resolved = await resolveClassicIssuedAsset(address, issuer, code);
      setMetadata({
        contractId: resolved.contractId,
        name: resolved.name,
        symbol: resolved.symbol,
        decimals: resolved.decimals,
        classicIssuer: issuer,
      });
      setClassicLinkNote(
        resolved.readFromSac
          ? null
          : "Trustless Work resolves this asset like their app: classic issuer + code on the trustline. We could not read the Soroban token contract here; listing uses 7 decimals (Stellar default for issued assets). Change decimals only if your token differs."
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsValidating(false);
    }
  };

  const canValidateClassic = classicIssuer.trim() && classicCode.trim();
  const canValidateSoroban = Boolean(contractId.trim());

  return (
    <div className="space-y-6">
      <Card className="p-6 space-y-5">
        <div>
          <h3 className="text-lg font-semibold">Link your token</h3>
          <p className="text-sm text-white/60">
            Choose how the token is represented: a classic issued asset (issuer
            G + code), or a custom Soroban SEP-41 contract (C…).
          </p>
        </div>

        <div className="flex flex-wrap gap-2 rounded-md border border-white/10 bg-white/5 p-1 text-xs">
          <button
            type="button"
            className={`px-3 py-2 rounded-md transition-colors ${
              mode === "classic"
                ? "bg-neko-teal/20 text-white"
                : "text-white/60 hover:text-white/80"
            }`}
            onClick={() => setModeAndReset("classic")}
          >
            Issued asset (G + code)
          </button>
          <button
            type="button"
            className={`px-3 py-2 rounded-md transition-colors ${
              mode === "soroban"
                ? "bg-neko-teal/20 text-white"
                : "text-white/60 hover:text-white/80"
            }`}
            onClick={() => setModeAndReset("soroban")}
          >
            Soroban contract (C…)
          </button>
        </div>

        {mode === "classic" ? (
          <div className="space-y-4">
            <Input
              label="Asset issuer (Stellar G-address)"
              placeholder="G…"
              value={classicIssuer}
              onChange={(e) => {
                setClassicIssuer(e.target.value);
                resetOutcome();
              }}
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
            />
            <Input
              label="Asset code"
              placeholder="e.g. NKB"
              value={classicCode}
              onChange={(e) => {
                setClassicCode(e.target.value);
                resetOutcome();
              }}
              maxLength={12}
              spellCheck={false}
              hint="1–12 alphanumeric characters (classic asset code)."
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => void validateClassic()}
                loading={isValidating}
                disabled={!canValidateClassic}
              >
                Validate
              </Button>
              {error ? (
                <p className="text-xs text-red-400 max-w-md">{error}</p>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <Input
              label="Token contract ID"
              placeholder="C…"
              value={contractId}
              onChange={(e) => {
                setContractId(e.target.value);
                resetOutcome();
              }}
              onBlur={() => {
                if (contractId.trim() && !metadata) void validateSoroban();
              }}
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => void validateSoroban()}
                loading={isValidating}
                disabled={!canValidateSoroban}
              >
                Validate
              </Button>
              {error ? (
                <p className="text-xs text-red-400 max-w-md">{error}</p>
              ) : null}
            </div>
          </div>
        )}
      </Card>

      {metadata ? (
        <Card className="p-6 space-y-4">
          <h4 className="text-sm font-semibold text-white/80">
            Detected metadata
          </h4>
          {classicLinkNote ? (
            <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/90">
              {classicLinkNote}
            </p>
          ) : null}
          <div className="grid gap-3 rounded-md border border-white/10 bg-white/5 p-4 text-sm">
            <Row label="SAC / contract" value={metadata.contractId} />
            {metadata.classicIssuer ? (
              <Row label="Classic issuer" value={metadata.classicIssuer} />
            ) : null}
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
      <span className="text-white/50 shrink-0">{label}</span>
      <span className="font-medium text-right break-all">{value}</span>
    </div>
  );
}
