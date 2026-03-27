"use client";

import React from "react";
import { sanitizeAmountInput } from "@/lib/helpers/tokenUtils";

interface AmountInputProps {
  value: string;
  onChange: (value: string) => void;
  currency: string;
  label: string;
  disabled?: boolean;
  placeholder?: string;
}

export const AmountInput: React.FC<AmountInputProps> = ({
  value,
  onChange,
  currency,
  label,
  disabled,
  placeholder = "0.00",
}) => {
  return (
    <div className="bg-[#1C1C1C] rounded-[20px] p-5 flex flex-col gap-3">
      <span className="text-white/50 text-sm font-medium">{label}</span>
      <div className="bg-[#2A2A2A] rounded-xl px-4 h-16 flex items-center gap-3">
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(sanitizeAmountInput(e.target.value))}
          placeholder={placeholder}
          disabled={disabled}
          className="bg-transparent text-white text-3xl font-bold flex-1 outline-none placeholder:text-white/20 disabled:opacity-50"
        />
        <span className="text-white/60 text-sm font-semibold shrink-0">
          {currency}
        </span>
      </div>
    </div>
  );
};
