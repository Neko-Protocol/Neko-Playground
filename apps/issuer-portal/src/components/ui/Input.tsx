"use client";

import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, id, ...rest }, ref) => {
    const inputId = id ?? rest.name;
    return (
      <div className="flex flex-col gap-1.5">
        {label ? (
          <label
            htmlFor={inputId}
            className="text-xs font-medium text-white/70"
          >
            {label}
          </label>
        ) : null}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "h-11 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white placeholder:text-white/30 focus:border-neko-teal focus:outline-none focus:ring-1 focus:ring-neko-teal/40",
            error && "border-red-500/60",
            className
          )}
          {...rest}
        />
        {error ? (
          <span className="text-xs text-red-400">{error}</span>
        ) : hint ? (
          <span className="text-xs text-white/40">{hint}</span>
        ) : null}
      </div>
    );
  }
);
Input.displayName = "Input";
