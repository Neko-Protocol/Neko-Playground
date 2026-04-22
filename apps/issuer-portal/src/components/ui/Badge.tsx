import { cn } from "@/lib/cn";
import type { HTMLAttributes } from "react";

type Tone = "teal" | "blue" | "amber" | "neutral" | "red";

const tones: Record<Tone, string> = {
  teal: "bg-neko-teal/15 text-neko-teal border-neko-teal/30",
  blue: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  amber: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  neutral: "bg-white/10 text-white/80 border-white/10",
  red: "bg-red-500/15 text-red-300 border-red-500/30",
};

export function Badge({
  tone = "neutral",
  className,
  ...rest
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        tones[tone],
        className
      )}
      {...rest}
    />
  );
}
