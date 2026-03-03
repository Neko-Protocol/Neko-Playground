"use client";

import React from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ReadonlyRowProps {
  label: string;
  value: string;
  /** When provided, renders an external link instead of the copy button. */
  href?: string | null;
  /** When provided with onCopy, enables copy button. */
  copyKey?: string;
  /** Value to copy when different from displayed value (e.g. full address). */
  copyValue?: string;
  onCopy?: (key: string, value: string) => void;
  copiedKey?: string | null;
  mono?: boolean;
}

const rowButtonClass =
  "shrink-0 rounded-lg p-1.5 text-white/30 transition-colors duration-150 hover:bg-white/10 hover:text-white/70";

export function ReadonlyRow({
  label,
  value,
  href,
  copyKey,
  copyValue,
  onCopy,
  copiedKey,
  mono = true,
}: ReadonlyRowProps) {
  const valueToCopy = copyValue ?? value;
  const isCopied = copyKey != null && copiedKey === copyKey;
  const showCopy = copyKey != null && onCopy != null && !href;

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl bg-[#2A2A2A] px-4 py-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-xs text-white/40">{label}</span>
        <span
          className={cn(
            "truncate text-sm text-white/80",
            mono ? "font-mono" : "font-medium"
          )}
        >
          {value}
        </span>
      </div>

      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`View ${label} on Stellar Expert`}
          className={rowButtonClass}
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      ) : showCopy ? (
        <button
          type="button"
          onClick={() => onCopy(copyKey, valueToCopy)}
          aria-label={`Copy ${label}`}
          className={rowButtonClass}
        >
          {isCopied ? (
            <Check className="h-3.5 w-3.5 text-[#39bfb7]" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>
      ) : null}
    </div>
  );
}
