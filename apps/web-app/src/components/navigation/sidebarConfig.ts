import {
  Compass,
  TrendingUp,
  ArrowLeftRight,
  Wallet,
  Settings,
  Shield,
} from "lucide-react";

export const NAV_ITEMS = [
  { label: "Explore", href: "/discover", icon: Compass },
  { label: "Earn", href: "/lending", icon: TrendingUp },
  { label: "Swap", href: "/swap", icon: ArrowLeftRight },
  { label: "Portfolio", href: "/dashboard", icon: Wallet },
  { label: "Settings", href: "/settings", icon: Settings },
  { label: "Admin", href: "/dashboard/admin", icon: Shield, adminOnly: true },
] as const;

export const CARD_STYLES = "rounded-[20px] bg-[#D3D3D3] p-5" as const;

export const CARD_BUTTON_STYLES =
  "flex w-full items-center justify-between rounded-full bg-[#0F0F0F] px-5 py-3 text-sm font-semibold text-white cursor-pointer" as const;
