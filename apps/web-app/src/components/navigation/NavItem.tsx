import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface NavItemProps {
  label: string;
  href: string;
  icon: React.ElementType;
  isActive: boolean;
  /** Shows a red danger dot on the item (e.g. an open position in breach). */
  showDot?: boolean;
  badge?: number;
}

export function NavItem({
  label,
  href,
  icon: Icon,
  isActive,
  showDot = false,
  badge,
}: NavItemProps) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 px-4 py-3 text-base font-medium transition-colors duration-150",
        isActive ? "text-white" : "text-white/35 hover:text-white/65"
      )}
      style={
        isActive
          ? { background: "#222222", borderRadius: "84px" }
          : { borderRadius: "84px" }
      }
    >
      <Icon
        className={cn(
          "h-5 w-5 shrink-0",
          isActive ? "text-white" : "text-white/35"
        )}
      />
      <div className="flex items-center justify-between w-full">
        <span>{label}</span>
        <div className="flex items-center gap-2 ml-2">
          {!!badge && badge > 0 && (
            <span className="flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-blue-500 text-[10px] font-bold text-white">
              {badge > 99 ? "99+" : badge}
            </span>
          )}
          {showDot && (
            <span
              className="h-2 w-2 shrink-0 rounded-full bg-red-500"
              aria-label="Position at risk"
              title="A borrow position is currently in breach"
            />
          )}
        </div>
      </div>
    </Link>
  );
}
