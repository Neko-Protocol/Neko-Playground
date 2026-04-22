"use client";

import { forwardRef, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, className, id, children, ...rest }, ref) => {
    const selectId = id ?? rest.name;
    return (
      <div className="flex flex-col gap-1.5">
        {label ? (
          <label
            htmlFor={selectId}
            className="text-xs font-medium text-white/70"
          >
            {label}
          </label>
        ) : null}
        <select
          ref={ref}
          id={selectId}
          className={cn(
            "h-11 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white focus:border-neko-teal focus:outline-none focus:ring-1 focus:ring-neko-teal/40",
            error && "border-red-500/60",
            className
          )}
          {...rest}
        >
          {children}
        </select>
        {error ? <span className="text-xs text-red-400">{error}</span> : null}
      </div>
    );
  }
);
Select.displayName = "Select";
