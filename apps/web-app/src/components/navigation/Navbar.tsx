"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletButton } from "@/features/wallet/components/WalletButton";

const Navbar: React.FC = () => {
  const pathname = usePathname();

  const navItems = [
    { name: "Dashboard", path: "/dashboard" },
    { name: "Swap", path: "/dashboard/swap" },
    { name: "Borrow", path: "/dashboard/borrowing" },
    { name: "Lend", path: "/dashboard/lending" },
    { name: "Oracle", path: "/dashboard/stocks" },
  ];

  return (
    <header className="sticky top-0 z-40 mx-auto w-full max-w-7xl px-6 py-4 mt-5">
      <div className="flex items-center justify-between">
        {/* Left Side: Logo & Name */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-3">
            <img src="/Neko.svg" alt="Neko Logo" className="h-14 w-auto" />
            <span className="text-3xl font-klein text-[#081F5C] tracking-wide">
              Neko
            </span>
          </Link>
        </div>

        {/* Center: Navigation Links */}
        <nav className="hidden md:flex items-center bg-[#081F5C] rounded-full px-6 py-2 shadow-xl border border-[#334EAC]/30">
          {navItems.map((item) => {
            // For Dashboard, only match exact path
            // For other routes, match exact path or paths that start with the route
            const isActive =
              item.path === "/dashboard"
                ? pathname === "/dashboard"
                : pathname === item.path ||
                  pathname?.startsWith(item.path + "/");
            return (
              <Link
                key={item.name}
                href={item.path}
                className={`px-10 py-2 rounded-full text-m font-medium transition-all duration-200 ${
                  isActive
                    ? "text-[#FFF9F0]"
                    : "text-[#BAD6EB] hover:text-[#FFF9F0] hover:bg-[#334EAC]/20"
                }`}
              >
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Right Side: Connect wallet (EVM or Stellar) */}
        <div className="flex items-center gap-4">
          <WalletButton />
        </div>
      </div>
    </header>
  );
};

export default Navbar;
