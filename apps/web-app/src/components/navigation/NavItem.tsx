import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface NavItemProps {
  label: string;
  href: string;
  icon: React.ElementType;
  isActive: boolean;
}

export function NavItem({ label, href, icon: Icon, isActive }: NavItemProps) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 px-4 py-3 text-base font-medium transition-colors duration-150",
        isActive
          ? "text-white"
          : "text-white/35 hover:text-white/65"
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
      {label}
    </Link>
  );
}
