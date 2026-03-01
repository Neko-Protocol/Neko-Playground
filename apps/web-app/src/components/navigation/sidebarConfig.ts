import {
  LayoutDashboard,
  ArrowLeftRight,
  Landmark,
  TrendingUp,
  BarChart2,
  Settings,
} from "lucide-react";

export const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Swap", href: "/dashboard/swap", icon: ArrowLeftRight },
  { label: "Borrow", href: "/dashboard/borrowing", icon: Landmark },
  { label: "Lend", href: "/dashboard/lending", icon: TrendingUp },
  { label: "Oracle", href: "/dashboard/stocks", icon: BarChart2 },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
] as const;

export const CARD_STYLES =
  "rounded-[20px] bg-[#D3D3D3] p-5" as const;

export const CARD_BUTTON_STYLES =
  "flex w-full items-center justify-between rounded-full bg-[#0F0F0F] px-5 py-3 text-sm font-semibold text-white cursor-pointer" as const;
