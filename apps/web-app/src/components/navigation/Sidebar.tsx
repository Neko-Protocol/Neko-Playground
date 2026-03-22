"use client";

import React, { useMemo } from "react";
import { usePathname } from "next/navigation";
import { useWalletType } from "@/hooks/useWalletType";
import { useStellarWallet } from "@/hooks/useStellarWallet";
import { NAV_ITEMS } from "./sidebarConfig";
import { SidebarLogo } from "./SidebarLogo";
import { NavItem } from "./NavItem";
import { ConnectedCard } from "./ConnectedCard";
import { SetupCard } from "./SetupCard";

export const SIDEBAR_WIDTH = "270px";

const ADMIN_ADDRESS = process.env.NEXT_PUBLIC_LENDING_ADMIN_ADDRESS ?? "";

export function Sidebar() {
  const pathname = usePathname();
  const { isStellarConnected, stellarAddress } = useWalletType();
  const { disconnect: disconnectStellar } = useStellarWallet();

  const isConnected = isStellarConnected;
  const activeAddress = stellarAddress ?? "";

  const navItems = useMemo(() => {
    return NAV_ITEMS.filter((item) => {
      const adminOnly = "adminOnly" in item && item.adminOnly;
      // Admin link: ONLY show when admin is configured AND connected wallet is admin
      if (adminOnly) {
        return Boolean(ADMIN_ADDRESS && activeAddress === ADMIN_ADDRESS);
      }
      return true;
    });
  }, [activeAddress]);

  const handleDisconnect = () => {
    void disconnectStellar();
  };

  const isActive = (href: string) =>
    href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname === href || pathname?.startsWith(`${href}/`);

  return (
    <aside className="hidden lg:flex fixed left-0 top-0 z-40 h-screen w-[270px] flex-col border-r border-white/5 bg-[#121212]">
      <SidebarLogo />

      <nav className="flex flex-1 flex-col gap-1 px-3 min-h-0 overflow-y-auto">
        {navItems.map(({ label, href, icon }) => (
          <NavItem
            key={href}
            label={label}
            href={href}
            icon={icon}
            isActive={isActive(href)}
          />
        ))}
      </nav>

      <div className="p-4 pt-6 overflow-y-auto">
        {isConnected && activeAddress ? (
          <ConnectedCard
            address={activeAddress}
            onDisconnect={handleDisconnect}
          />
        ) : (
          <SetupCard />
        )}
      </div>
    </aside>
  );
}
