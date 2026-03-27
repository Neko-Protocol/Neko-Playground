import {
  LayoutDashboard,
  ArrowLeftRight,
  Landmark,
  TrendingUp,
  BarChart2,
  Settings,
  Shield,
  Banknote,
} from "lucide-react";

export const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Lend", href: "/lending", icon: TrendingUp },
  { label: "Borrow", href: "/borrowing", icon: Landmark },
  { label: "Swap", href: "/swap", icon: ArrowLeftRight },
  { label: "Ramps", href: "/ramps", icon: Banknote },
  { label: "Discover", href: "/discover", icon: BarChart2 },
  { label: "Settings", href: "/settings", icon: Settings },
  { label: "Admin", href: "/dashboard/admin", icon: Shield, adminOnly: true },
] as const;

export const CARD_STYLES = "rounded-[20px] bg-[#D3D3D3] p-5" as const;

export const CARD_BUTTON_STYLES =
  "flex w-full items-center justify-between rounded-full bg-[#0F0F0F] px-5 py-3 text-sm font-semibold text-white cursor-pointer" as const;
