"use client";

import { cn } from "@/lib/utils";

interface BackstopAmountInputProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  max?: string;
  hint?: string;
  className?: string;
}

export function BackstopAmountInput({
  label,
  value,
  onChange,
  disabled,
  placeholder = "0.00",
  max,
  hint,
  className,
}: BackstopAmountInputProps) {
  const hasMax = !!max && parseFloat(max) > 0;

  return (
    <div className={cn(className)}>
      {(label || hasMax) && (
        <div className="flex items-center justify-between mb-1.5">
          {label && (
            <label className="text-white/40 text-xs font-medium">{label}</label>
          )}
          {hasMax && (
            <button
              type="button"
              onClick={() => onChange(max!)}
              disabled={disabled}
              className="text-[#229EDF] text-xs font-semibold hover:text-[#229EDF]/70 transition-colors disabled:opacity-40"
            >
              Max: {parseFloat(max!).toFixed(4)}
            </button>
          )}
        </div>
      )}
      <input
        type="number"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full bg-[#2A2A2A] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 outline-none focus:border-[#229EDF]/50 transition-colors disabled:opacity-50"
      />
      {hint && <p className="text-white/30 text-xs mt-1.5 italic">{hint}</p>}
    </div>
  );
}
