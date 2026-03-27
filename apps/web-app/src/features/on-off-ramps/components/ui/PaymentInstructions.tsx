"use client";

import React, { useState } from "react";
import { Copy, CheckCircle, ExternalLink } from "lucide-react";
import type { PaymentInstructions } from "@/lib/anchors/types";

interface PaymentInstructionsProps {
  instructions: PaymentInstructions;
  statusPage?: string;
  onSimulateFiat?: () => void;
  isSandbox?: boolean;
  isSimulating?: boolean;
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-1">
      <span className="text-white/40 text-xs">{label}</span>
      <div className="flex items-center justify-between bg-[#2A2A2A] rounded-lg px-3 py-2 gap-2">
        <span className="text-white text-sm font-mono truncate">{value}</span>
        <button
          onClick={copy}
          className="shrink-0 text-white/40 hover:text-white/80 transition-colors"
        >
          {copied ? (
            <CheckCircle className="h-4 w-4 text-green-400" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}

export const PaymentInstructionsDisplay: React.FC<PaymentInstructionsProps> = ({
  instructions,
  statusPage,
  onSimulateFiat,
  isSandbox,
  isSimulating,
}) => {
  if (instructions.type !== "spei") return null;

  return (
    <div className="bg-[#1C1C1C] rounded-[20px] p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
          <span className="text-white font-semibold text-sm">
            Send payment via SPEI
          </span>
        </div>
        {statusPage && (
          <a
            href={statusPage}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[#229EDF] text-xs hover:underline"
          >
            View on Etherfuse
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      <p className="text-white/50 text-xs">
        Transfer the exact amount to the CLABE below. Use the reference number
        to ensure your payment is matched.
      </p>

      <div className="flex flex-col gap-3">
        <CopyField label="CLABE" value={instructions.clabe} />
        {instructions.reference && (
          <CopyField label="Reference" value={instructions.reference} />
        )}
        <CopyField
          label="Amount"
          value={`${instructions.amount} ${instructions.currency}`}
        />
        {instructions.bankName && (
          <div className="flex justify-between">
            <span className="text-white/40 text-xs">Bank</span>
            <span className="text-white/60 text-xs">
              {instructions.bankName}
            </span>
          </div>
        )}
        {instructions.beneficiary && (
          <div className="flex justify-between">
            <span className="text-white/40 text-xs">Beneficiary</span>
            <span className="text-white/60 text-xs">
              {instructions.beneficiary}
            </span>
          </div>
        )}
      </div>

      {isSandbox && onSimulateFiat && (
        <>
          <div className="h-px bg-white/10" />
          <button
            onClick={onSimulateFiat}
            disabled={isSimulating}
            className="w-full py-2.5 rounded-xl border border-yellow-400/30 bg-yellow-400/5 text-yellow-400 text-sm font-medium hover:bg-yellow-400/10 transition-colors disabled:opacity-50"
          >
            {isSimulating ? "Processing..." : "Mock Payment (Etherfuse)"}
          </button>
        </>
      )}
    </div>
  );
};
