"use client";

import React, { useState } from "react";
import { Plus } from "lucide-react";
import type { SavedFiatAccount } from "@/lib/anchors/types";
import { maskClabe } from "../../utils/formatters";

interface FiatAccountSelectorProps {
  accounts: SavedFiatAccount[];
  selected: SavedFiatAccount | null;
  onSelect: (account: SavedFiatAccount) => void;
  onAddNew: (data: {
    clabe: string;
    beneficiary: string;
    bankName?: string;
  }) => Promise<void>;
  isLoading?: boolean;
  isRegistering?: boolean;
}

export const FiatAccountSelector: React.FC<FiatAccountSelectorProps> = ({
  accounts,
  selected,
  onSelect,
  onAddNew,
  isLoading,
  isRegistering,
}) => {
  const [showForm, setShowForm] = useState(accounts.length === 0);
  const [clabe, setClabe] = useState("");
  const [beneficiary, setBeneficiary] = useState("");
  const [bankName, setBankName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (clabe.length !== 18) {
      setFormError("CLABE must be 18 digits");
      return;
    }
    if (!beneficiary.trim()) {
      setFormError("Beneficiary name is required");
      return;
    }
    try {
      await onAddNew({
        clabe,
        beneficiary: beneficiary.trim(),
        bankName: bankName.trim() || undefined,
      });
      setShowForm(false);
      setClabe("");
      setBeneficiary("");
      setBankName("");
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to register account"
      );
    }
  };

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

      {accounts.length > 0 && !showForm && (
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
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 p-3 rounded-xl border border-dashed border-white/20 text-white/40 hover:text-white/60 hover:border-white/40 transition-all text-sm"
          >
            <Plus className="h-4 w-4" />
            Add new bank account
          </button>
        </div>
      )}

      {(showForm || accounts.length === 0) && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-white/40 text-xs">CLABE (18 digits)</label>
            <input
              type="text"
              value={clabe}
              onChange={(e) =>
                setClabe(e.target.value.replace(/\D/g, "").slice(0, 18))
              }
              placeholder="000000000000000000"
              className="bg-[#2A2A2A] text-white rounded-xl px-4 py-3 text-sm font-mono outline-none border border-white/10 focus:border-[#229EDF] transition-colors"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-white/40 text-xs">Beneficiary Name</label>
            <input
              type="text"
              value={beneficiary}
              onChange={(e) => setBeneficiary(e.target.value)}
              placeholder="Full name on account"
              className="bg-[#2A2A2A] text-white rounded-xl px-4 py-3 text-sm outline-none border border-white/10 focus:border-[#229EDF] transition-colors"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-white/40 text-xs">
              Bank Name (optional)
            </label>
            <input
              type="text"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="e.g. BBVA, Santander"
              className="bg-[#2A2A2A] text-white rounded-xl px-4 py-3 text-sm outline-none border border-white/10 focus:border-[#229EDF] transition-colors"
            />
          </div>
          {formError && <p className="text-red-400 text-xs">{formError}</p>}
          <div className="flex gap-2">
            {accounts.length > 0 && (
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 py-3 rounded-xl bg-[#2A2A2A] text-white/60 text-sm font-medium"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={isRegistering}
              className="flex-1 py-3 rounded-xl bg-[#229EDF] hover:bg-[#1a8bc7] text-white font-semibold text-sm transition-colors disabled:opacity-50"
            >
              {isRegistering ? "Registering..." : "Save Account"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
