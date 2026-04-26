"use client";

import { useEffect, useMemo, useState } from "react";
import { StrKey } from "@stellar/stellar-sdk";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useWallet } from "@/hooks/useWallet";
import {
  applyPricingNormalization,
  fetchOracleMetadata,
  fetchTokenBalance,
  simulateOraclePrice,
  type OracleMetadata,
  type OraclePriceSample,
} from "@/lib/stellar/contract";
import { useListAsset } from "@/features/issuer/hooks/useListAsset";
import { REFLECTOR_ORACLES } from "@/lib/constants";
import type { LinkTokenValues } from "@/features/issuer/components/LinkTokenStep";
import type { OracleAsset, PricingMode } from "@/types";

interface DepositStepProps {
  token: LinkTokenValues;
  onListed: (res: {
    token: LinkTokenValues;
    listedAmount: string;
    pricing: PricingMode;
    listTx: string;
    escrowId: string;
    escrowAddress: string;
    mockEscrow: boolean;
    issuerAddress: string;
    escrowAssetSymbol: string;
  }) => void;
}

function formatBalance(base: bigint, decimals: number): string {
  if (base === 0n) return "0";
  const s = base.toString().padStart(decimals + 1, "0");
  const whole = s.slice(0, -decimals) || "0";
  const frac = s.slice(-decimals).replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole;
}

const CONTRACT_ID_RE = /^C[A-Z2-7]{55}$/;
type OracleSelection = (typeof REFLECTOR_ORACLES)[number]["id"] | "custom";
type PricingTab = "fixed" | "oracle";
type PegKind = "stellar" | "other";
type MethodKind = "lastprice" | "cross";

export function DepositStep({ token, onListed }: DepositStepProps) {
  const { address } = useWallet();
  const { mutateAsync, isPending, error } = useListAsset();

  const [amount, setAmount] = useState("");
  const [issuerGAddress, setIssuerGAddress] = useState("");
  const [assetCode, setAssetCode] = useState("");
  const [balance, setBalance] = useState<bigint | null>(null);
  const [balanceError, setBalanceError] = useState<string | null>(null);

  // pricing
  const [pricingTab, setPricingTab] = useState<PricingTab>("fixed");
  const [priceXlm, setPriceXlm] = useState("");

  // oracle
  const [oracleSel, setOracleSel] = useState<OracleSelection>("stellar");
  const [customOracle, setCustomOracle] = useState("");
  const [pegKind, setPegKind] = useState<PegKind>("other");
  const [pegStellar, setPegStellar] = useState("");
  const [pegSymbol, setPegSymbol] = useState("AAPL");
  const [method, setMethod] = useState<MethodKind>("cross");
  const [quoteSymbol, setQuoteSymbol] = useState("XLM");
  const [premiumBps, setPremiumBps] = useState("0");
  const [maxStaleness, setMaxStaleness] = useState("600");
  const [oracleMeta, setOracleMeta] = useState<OracleMetadata | null>(null);
  const [oracleMetaError, setOracleMetaError] = useState<string | null>(null);
  const [oraclePrice, setOraclePrice] = useState<OraclePriceSample | null>(
    null
  );
  const [oraclePriceError, setOraclePriceError] = useState<string | null>(null);
  const [oracleSimLoading, setOracleSimLoading] = useState(false);

  const oracleAddress = useMemo(() => {
    if (oracleSel === "custom") return customOracle.trim();
    return REFLECTOR_ORACLES.find((o) => o.id === oracleSel)!.address;
  }, [oracleSel, customOracle]);

  const peg: OracleAsset = useMemo(
    () =>
      pegKind === "stellar"
        ? { kind: "stellar", address: pegStellar.trim() }
        : { kind: "other", symbol: pegSymbol.trim().toUpperCase() },
    [pegKind, pegStellar, pegSymbol]
  );

  const quote: OracleAsset | undefined = useMemo(
    () =>
      method === "cross"
        ? { kind: "other", symbol: quoteSymbol.trim().toUpperCase() }
        : undefined,
    [method, quoteSymbol]
  );

  useEffect(() => {
    if (address) setIssuerGAddress(address);
  }, [address]);

  useEffect(() => {
    setAssetCode(token.symbol.trim().toUpperCase());
  }, [token.contractId, token.symbol]);

  // Token balance
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

  // Live oracle metadata + price preview (debounced)
  useEffect(() => {
    if (pricingTab !== "oracle" || !address) return;
    if (!CONTRACT_ID_RE.test(oracleAddress)) {
      setOracleMeta(null);
      setOracleMetaError(null);
      setOraclePrice(null);
      setOraclePriceError(null);
      return;
    }
    let cancelled = false;
    setOracleSimLoading(true);
    setOracleMetaError(null);
    setOraclePriceError(null);
    const timer = setTimeout(async () => {
      try {
        const meta = await fetchOracleMetadata(address, oracleAddress);
        if (cancelled) return;
        setOracleMeta(meta);
        try {
          const sample = await simulateOraclePrice(
            address,
            oracleAddress,
            method,
            peg,
            quote
          );
          if (cancelled) return;
          setOraclePrice(sample);
          if (!sample) {
            setOraclePriceError(
              "Oracle returned no price for this asset. Try a different peg or method."
            );
          }
        } catch (e) {
          if (!cancelled) setOraclePriceError((e as Error).message);
        }
      } catch (e) {
        if (!cancelled) {
          setOracleMeta(null);
          setOracleMetaError((e as Error).message);
        }
      } finally {
        if (!cancelled) setOracleSimLoading(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [pricingTab, address, oracleAddress, method, peg, quote]);

  const previewPriceStroops = useMemo(() => {
    if (!oraclePrice) return null;
    return applyPricingNormalization(
      oraclePrice.price,
      oraclePrice.decimals,
      Number(premiumBps) || 0
    );
  }, [oraclePrice, premiumBps]);

  const previewPriceXlm = previewPriceStroops
    ? Number(previewPriceStroops) / 10_000_000
    : null;

  const pricing: PricingMode | null = useMemo(() => {
    if (pricingTab === "fixed") {
      const v = Number(priceXlm);
      if (!isFinite(v) || v <= 0) return null;
      return { type: "fixed", priceXlm: v };
    }
    if (!CONTRACT_ID_RE.test(oracleAddress)) return null;
    if (pegKind === "stellar" && !CONTRACT_ID_RE.test(pegStellar.trim())) {
      return null;
    }
    if (pegKind === "other" && !pegSymbol.trim()) return null;
    if (method === "cross" && !quoteSymbol.trim()) return null;
    const bps = Number(premiumBps);
    const stale = Number(maxStaleness);
    if (!Number.isFinite(bps) || bps <= -10000 || bps >= 10000) return null;
    if (!Number.isFinite(stale) || stale <= 0) return null;
    return {
      type: "oracle",
      oracleContract: oracleAddress,
      method,
      base: peg,
      quote,
      premiumBps: Math.trunc(bps),
      maxStalenessSecs: Math.trunc(stale),
    };
  }, [
    pricingTab,
    priceXlm,
    oracleAddress,
    pegKind,
    pegStellar,
    pegSymbol,
    method,
    quoteSymbol,
    premiumBps,
    maxStaleness,
    peg,
    quote,
  ]);

  const issuerTrim = issuerGAddress.trim();
  const symbolTrim = assetCode.trim().toUpperCase();

  const issuerFieldError = !issuerTrim
    ? "Required"
    : !StrKey.isValidEd25519PublicKey(issuerTrim)
      ? "Invalid Stellar G-address"
      : address && issuerTrim !== address
        ? "Must match your connected wallet (it signs the Trustless Work deploy)."
        : undefined;

  const assetCodeError = !symbolTrim
    ? "Required"
    : symbolTrim.length > 12
      ? "Max 12 characters (Stellar-style code)"
      : !/^[A-Z0-9]+$/.test(symbolTrim)
        ? "Use letters and digits only"
        : undefined;

  const handleList = async () => {
    if (!pricing) return;
    try {
      const res = await mutateAsync({
        token,
        issuerAddress: issuerTrim,
        escrowAssetSymbol: symbolTrim,
        listedAmount: amount,
        pricing,
      });
      onListed({
        token,
        listedAmount: amount,
        pricing,
        listTx: res.listTx,
        escrowId: res.escrowId,
        escrowAddress: res.escrowAddress,
        mockEscrow: res.mockEscrow,
        issuerAddress: issuerTrim,
        escrowAssetSymbol: symbolTrim,
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

  const canSubmit =
    Number(amount) > 0 &&
    pricing !== null &&
    !isPending &&
    !issuerFieldError &&
    !assetCodeError;

  return (
    <Card className="p-8 space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Deposit liquidity</h3>
        <p className="text-sm text-white/60">
          Choose how much {token.symbol} to list and how it should be priced.
          You&apos;ll sign one atomic transaction: tokens transfer to a
          Trustless Work escrow and the listing is registered on-chain.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Input
          label="Issuer Stellar address (G)"
          placeholder="G…"
          value={issuerGAddress}
          onChange={(e) => setIssuerGAddress(e.target.value)}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          error={issuerFieldError}
          hint="Same account as your connected wallet — used for Trustless Work roles and trustline."
        />
        <Input
          label="Asset code for escrow"
          placeholder="e.g. NKB"
          value={assetCode}
          onChange={(e) => setAssetCode(e.target.value.toUpperCase())}
          maxLength={12}
          error={assetCodeError}
          hint="Sent to Trustless Work as trustline symbol (often matches your token symbol)."
        />
      </div>

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

      <div>
        <div className="mb-3 inline-flex rounded-md border border-white/10 bg-white/5 p-1 text-xs">
          <button
            type="button"
            className={`px-3 py-1.5 rounded ${
              pricingTab === "fixed"
                ? "bg-neko-teal/20 text-white"
                : "text-white/60"
            }`}
            onClick={() => setPricingTab("fixed")}
          >
            Fixed price
          </button>
          <button
            type="button"
            className={`px-3 py-1.5 rounded ${
              pricingTab === "oracle"
                ? "bg-neko-teal/20 text-white"
                : "text-white/60"
            }`}
            onClick={() => setPricingTab("oracle")}
          >
            Oracle (Reflector)
          </button>
        </div>

        {pricingTab === "fixed" ? (
          <Input
            label="Price per token (XLM)"
            type="number"
            min={0}
            step="0.0000001"
            value={priceXlm}
            onChange={(e) => setPriceXlm(e.target.value)}
            required
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <Select
              label="Oracle contract"
              value={oracleSel}
              onChange={(e) => setOracleSel(e.target.value as OracleSelection)}
            >
              {REFLECTOR_ORACLES.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label} ({o.base})
                </option>
              ))}
              <option value="custom">Custom address…</option>
            </Select>

            {oracleSel === "custom" ? (
              <Input
                label="Custom oracle contract"
                placeholder="C..."
                value={customOracle}
                onChange={(e) => setCustomOracle(e.target.value)}
                error={
                  customOracle && !CONTRACT_ID_RE.test(customOracle.trim())
                    ? "Invalid contract id"
                    : undefined
                }
              />
            ) : (
              <div className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/60">
                {REFLECTOR_ORACLES.find((o) => o.id === oracleSel)!.description}
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-white/70">
                Peg asset
              </label>
              <div className="mt-1.5 flex gap-2 text-xs">
                <button
                  type="button"
                  className={`px-3 py-1.5 rounded border ${
                    pegKind === "stellar"
                      ? "border-neko-teal bg-neko-teal/10"
                      : "border-white/10 bg-white/5 text-white/60"
                  }`}
                  onClick={() => setPegKind("stellar")}
                >
                  Stellar contract
                </button>
                <button
                  type="button"
                  className={`px-3 py-1.5 rounded border ${
                    pegKind === "other"
                      ? "border-neko-teal bg-neko-teal/10"
                      : "border-white/10 bg-white/5 text-white/60"
                  }`}
                  onClick={() => setPegKind("other")}
                >
                  Symbol
                </button>
              </div>
              {pegKind === "stellar" ? (
                <Input
                  className="mt-2"
                  placeholder="C..."
                  value={pegStellar}
                  onChange={(e) => setPegStellar(e.target.value)}
                />
              ) : (
                <Input
                  className="mt-2"
                  placeholder="AAPL"
                  value={pegSymbol}
                  onChange={(e) => setPegSymbol(e.target.value)}
                />
              )}
            </div>

            <div>
              <label className="text-xs font-medium text-white/70">
                Pricing method
              </label>
              <div className="mt-1.5 flex gap-2 text-xs">
                <button
                  type="button"
                  className={`px-3 py-1.5 rounded border ${
                    method === "lastprice"
                      ? "border-neko-teal bg-neko-teal/10"
                      : "border-white/10 bg-white/5 text-white/60"
                  }`}
                  onClick={() => setMethod("lastprice")}
                >
                  Direct (lastprice)
                </button>
                <button
                  type="button"
                  className={`px-3 py-1.5 rounded border ${
                    method === "cross"
                      ? "border-neko-teal bg-neko-teal/10"
                      : "border-white/10 bg-white/5 text-white/60"
                  }`}
                  onClick={() => setMethod("cross")}
                >
                  Cross (x_last_price)
                </button>
              </div>
              {method === "cross" ? (
                <Input
                  className="mt-2"
                  label="Quote asset symbol"
                  placeholder="XLM"
                  value={quoteSymbol}
                  onChange={(e) => setQuoteSymbol(e.target.value)}
                />
              ) : null}
            </div>

            <Input
              label="Premium / discount (bps)"
              type="number"
              min={-9999}
              max={9999}
              value={premiumBps}
              onChange={(e) => setPremiumBps(e.target.value)}
              hint="+500 = +5% premium, -300 = -3% discount"
            />
            <Input
              label="Max staleness (seconds)"
              type="number"
              min={1}
              value={maxStaleness}
              onChange={(e) => setMaxStaleness(e.target.value)}
              hint="Reflector ticks every ~5min; default 600s."
            />

            <div className="md:col-span-2 rounded-md border border-white/10 bg-white/5 p-4 text-xs space-y-1">
              {oracleSimLoading ? (
                <p className="text-white/50">Simulating oracle…</p>
              ) : oracleMetaError ? (
                <p className="text-red-400">Oracle: {oracleMetaError}</p>
              ) : oracleMeta ? (
                <>
                  <p>
                    <span className="text-white/50">Base: </span>
                    {oracleMeta.base.kind === "stellar"
                      ? oracleMeta.base.address.slice(0, 10) + "…"
                      : oracleMeta.base.symbol}
                    <span className="text-white/50"> · Decimals: </span>
                    {oracleMeta.decimals}
                    <span className="text-white/50"> · Resolution: </span>
                    {oracleMeta.resolution}s
                  </p>
                  {oraclePriceError ? (
                    <p className="text-red-400">{oraclePriceError}</p>
                  ) : oraclePrice && previewPriceXlm !== null ? (
                    <>
                      <p>
                        <span className="text-white/50">Live price: </span>
                        {previewPriceXlm.toLocaleString(undefined, {
                          maximumFractionDigits: 7,
                        })}{" "}
                        XLM / token
                      </p>
                      <p className="text-white/50">
                        Updated{" "}
                        {Math.max(
                          0,
                          Math.floor(Date.now() / 1000) - oraclePrice.timestamp
                        )}
                        s ago
                      </p>
                    </>
                  ) : null}
                  {oracleSel === "custom" ? (
                    <p className="mt-1 text-amber-400">
                      ⚠ Custom oracle — make sure you trust this contract.
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="text-white/50">
                  Pick an oracle and a peg asset to preview the live price.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-2 rounded-lg border border-white/10 bg-white/5 p-4 text-sm">
        <Row label="Token" value={`${token.name} (${token.symbol})`} />
        <Row label="Contract" value={token.contractId} className="truncate" />
        <Row label="TW trustline symbol" value={symbolTrim || "—"} />
        {pricing?.type === "fixed" ? (
          <Row
            label="Total raise (if fully sold)"
            value={
              Number(amount) > 0
                ? `${(Number(amount) * pricing.priceXlm).toLocaleString()} XLM`
                : "—"
            }
          />
        ) : pricing?.type === "oracle" && previewPriceXlm !== null ? (
          <Row
            label="Total raise @ current price"
            value={
              Number(amount) > 0
                ? `${(Number(amount) * previewPriceXlm).toLocaleString(
                    undefined,
                    { maximumFractionDigits: 2 }
                  )} XLM`
                : "—"
            }
          />
        ) : null}
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
        With Trustless Work enabled, Freighter may ask for several signatures
        (deploy escrow, transfer tokens, then register the listing). Each step
        uses a single Soroban operation so the wallet can sign it.
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
