"use client";

import { Info, AlertTriangle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type AlertVariant = "info" | "warning" | "success";

interface BackstopInfoAlertProps {
  variant?: AlertVariant;
  title?: string;
  children: ReactNode;
  className?: string;
}

const CONFIG: Record<
  AlertVariant,
  {
    bg: string;
    border: string;
    iconColor: string;
    titleColor: string;
    bodyColor: string;
    Icon: React.ElementType;
  }
> = {
  info: {
    bg: "bg-[#229EDF]/10",
    border: "border-[#229EDF]/20",
    iconColor: "text-[#229EDF]",
    titleColor: "text-[#229EDF]",
    bodyColor: "text-[#229EDF]/70",
    Icon: Info,
  },
  warning: {
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    iconColor: "text-amber-400",
    titleColor: "text-amber-400",
    bodyColor: "text-amber-400/80",
    Icon: AlertTriangle,
  },
  success: {
    bg: "bg-green-500/10",
    border: "border-green-500/20",
    iconColor: "text-green-400",
    titleColor: "text-green-400",
    bodyColor: "text-green-400/80",
    Icon: CheckCircle,
  },
};

export function BackstopInfoAlert({
  variant = "info",
  title,
  children,
  className,
}: BackstopInfoAlertProps) {
  const { bg, border, iconColor, titleColor, bodyColor, Icon } =
    CONFIG[variant];

  return (
    <div
      className={cn(
        "rounded-xl border p-3 flex items-start gap-2.5",
        bg,
        border,
        className
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0 mt-0.5", iconColor)} />
      <div className="min-w-0">
        {title && (
          <p className={cn("text-xs font-semibold", titleColor)}>{title}</p>
        )}
        <div className={cn("text-xs", title ? "mt-0.5" : "", bodyColor)}>
          {children}
        </div>
      </div>
    </div>
  );
}
