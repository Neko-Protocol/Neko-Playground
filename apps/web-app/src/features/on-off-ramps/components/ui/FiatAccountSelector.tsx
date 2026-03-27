"use client";

import React from "react";
import { ExternalLink } from "lucide-react";
import type { SavedFiatAccount } from "@/lib/anchors/types";
import { maskClabe } from "../../utils/formatters";

interface FiatAccountSelectorProps {
  accounts: SavedFiatAccount[];
  selected: SavedFiatAccount | null;
  onSelect: (account: SavedFiatAccount) => void;
  isLoading?: boolean;
  /** If provided, shows a "need another account?" hint linking to this URL */
  addAccountUrl?: string;
}

export const FiatAccountSelector: React.FC<FiatAccountSelectorProps> = ({
  accounts,
  selected,
  onSelect,
  isLoading,
  addAccountUrl,
}) => {
  if (isLoading) {
    return (
      <div className="bg-[#1C1C1C] rounded-[20px] p-5">
        <div className="animate-pulse h-16 bg-white/5 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="bg-[#1C1C1C] rounded-[20px] p-5 flex flex-col gap-4">
      <span className="text-white/50 text-sm font-medium">
        Receive payment to
      </span>

      {accounts.length === 0 ? (
        <p className="text-white/40 text-sm text-center py-2">
          No bank accounts found. Complete KYC verification to register one.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {accounts.map((account) => (
            <button
              key={account.id}
              onClick={() => onSelect(account)}
              className={`flex items-center justify-between p-3 rounded-xl border transition-all text-left ${
                selected?.id === account.id
                  ? "border-[#229EDF] bg-[#229EDF]/10"
                  : "border-white/10 bg-[#2A2A2A] hover:border-white/30"
              }`}
            >
              <div>
                <p className="text-white text-sm font-medium">
                  {account.accountHolderName || "Bank Account"}
                </p>
                <p className="text-white/40 text-xs font-mono">
                  {maskClabe(account.accountNumber)}
                </p>
              </div>
              {selected?.id === account.id && (
                <div className="w-4 h-4 rounded-full bg-[#229EDF] flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-white" />
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {addAccountUrl && (
        <div className="flex items-start gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
          <div className="flex-1">
            <p className="text-white/60 text-xs">
              Need to add or change a bank account? Bank accounts are managed
              through the Etherfuse portal during KYC verification.
            </p>
          </div>
          <a
            href={addAccountUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 flex items-center gap-1 text-[#229EDF] hover:text-[#1a8bc7] text-xs font-medium transition-colors"
          >
            Open portal
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}
    </div>
  );
};
