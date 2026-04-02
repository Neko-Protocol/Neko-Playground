"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { X, Copy, Check, Droplets, Zap, FileText } from "lucide-react";
import { ModalPortal } from "@/components/ui/ModalPortal";
import type { VaultData } from "../../types/vault";

interface VaultDetailModalProps {
  vault: VaultData;
  onClose: () => void;
}

function CopyableAddress({
  label,
  address,
}: {
  label: string;
  address: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const short = `${address.slice(0, 6)}...${address.slice(-6)}`;

  return (
    <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
      <span className="text-white/40 text-xs font-medium capitalize w-24 shrink-0">
        {label}
      </span>
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-white/60 text-xs font-mono truncate">
          {short}
        </span>
        <button
          aria-label={`Copy ${label} address`}
          onClick={handleCopy}
          className="shrink-0 p-1 rounded-md hover:bg-white/10 transition-colors text-white/30 hover:text-white/70"
        >
          {copied ? (
            <Check className="h-3 w-3 text-emerald-400" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </button>
      </div>
    </div>
  );
}

export function VaultDetailModal({ vault, onClose }: VaultDetailModalProps) {
  const detail = vault.detail;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 220);
  };

  return (
    <ModalPortal>
      {/* backdrop */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-200"
        style={{
          background: "rgba(0,0,0,0.7)",
          backdropFilter: "blur(4px)",
          opacity: visible ? 1 : 0,
        }}
        onClick={handleClose}
      >
        {/* panel */}
        <div
          className="relative w-full max-w-xl max-h-[90vh] flex flex-col rounded-2xl overflow-hidden transition-all duration-200"
          style={{
            background: "#141414",
            border: "1px solid rgba(255,255,255,0.07)",
            boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
            opacity: visible ? 1 : 0,
            transform: visible
              ? "translateY(0) scale(1)"
              : "translateY(12px) scale(0.97)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            aria-label="Close modal"
            onClick={handleClose}
            className="absolute top-3 right-3 z-10 p-1.5 rounded-lg hover:bg-white/10 text-white/30 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>

          {/* ── HEADER ── */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5 shrink-0 pr-10">
            <div className="w-9 h-9 rounded-full bg-[#222] flex items-center justify-center overflow-hidden shrink-0">
              <Image
                src={vault.supplyAsset.iconSrc}
                alt={vault.supplyAsset.symbol}
                width={24}
                height={24}
                unoptimized
              />
            </div>
            <div className="min-w-0">
              <h2 className="text-white font-bold text-base leading-tight truncate">
                {vault.name}
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-white/40 text-xs">{vault.apy7d} APY</span>
                <span className="text-white/20 text-xs">·</span>
                <span className="text-white/40 text-xs">TVL {vault.tvl}</span>
              </div>
            </div>
          </div>

          {/* ── SCROLLABLE BODY ── */}
          <div className="vault-scroll overflow-y-auto flex-1 px-5 py-5 space-y-6">
            {/* Description */}
            {detail?.description && (
              <p className="text-white/60 text-sm leading-relaxed">
                {detail.description}
              </p>
            )}

            {/* Strategy */}
            {detail?.strategies && detail.strategies.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="h-3.5 w-3.5 text-[#229EDF]" />
                  <h3 className="text-white text-sm font-semibold">Strategy</h3>
                </div>
                <div className="space-y-2">
                  {detail.strategies.map((s) => (
                    <div
                      key={s.protocol}
                      className="flex gap-3 rounded-xl bg-white/3 border border-white/5 px-4 py-3"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-[#229EDF] shrink-0 mt-1.5" />
                      <div>
                        <span className="text-white/80 text-xs font-semibold">
                          {s.protocol}
                        </span>
                        <p className="text-white/40 text-xs mt-0.5 leading-relaxed">
                          {s.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Contracts */}
            {detail?.contracts && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="h-3.5 w-3.5 text-[#229EDF]" />
                  <h3 className="text-white text-sm font-semibold">
                    Contracts
                  </h3>
                </div>
                <div className="rounded-xl bg-white/3 border border-white/5 px-4 py-1 mb-2">
                  <p className="text-white/20 text-[10px] font-medium uppercase tracking-wide pt-2 pb-1">
                    Vault
                  </p>
                  <CopyableAddress
                    label="vault"
                    address={detail.contracts.vault}
                  />
                </div>
                <div className="rounded-xl bg-white/3 border border-white/5 px-4 py-1 mb-2">
                  <p className="text-white/20 text-[10px] font-medium uppercase tracking-wide pt-2 pb-1">
                    Pools
                  </p>
                  {Object.entries(detail.contracts.pools).map(
                    ([name, addr]) => (
                      <CopyableAddress key={name} label={name} address={addr} />
                    )
                  )}
                </div>
                <div className="rounded-xl bg-white/3 border border-white/5 px-4 py-1">
                  <p className="text-white/20 text-[10px] font-medium uppercase tracking-wide pt-2 pb-1">
                    Strategies
                  </p>
                  {Object.entries(detail.contracts.strategies).map(
                    ([name, addr]) => (
                      <CopyableAddress key={name} label={name} address={addr} />
                    )
                  )}
                </div>
              </section>
            )}

            {/* Liquidity */}
            {detail?.liquidity && (
              <section>
                <div className="flex items-center gap-2 mb-2">
                  <Droplets className="h-3.5 w-3.5 text-[#229EDF]" />
                  <h3 className="text-white text-sm font-semibold">
                    Liquidity
                  </h3>
                </div>
                <p className="text-white/50 text-xs leading-relaxed">
                  {detail.liquidity}
                </p>
              </section>
            )}
          </div>

          {/* ── FOOTER ── */}
          <div className="px-5 py-4 border-t border-white/5 shrink-0">
            <button
              aria-label={`Deposit into ${vault.name}`}
              className="w-full py-3 rounded-xl text-sm font-bold text-white transition-colors duration-200 bg-[#229EDF] hover:bg-[#1a8bc7]"
            >
              Deposit
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
