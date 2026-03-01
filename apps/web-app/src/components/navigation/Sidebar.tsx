"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { useDisconnect } from "wagmi";
import { useWalletType } from "@/hooks/useWalletType";
import { useStellarWallet } from "@/hooks/useStellarWallet";
import { NAV_ITEMS } from "./sidebarConfig";
import { SidebarLogo } from "./SidebarLogo";
import { NavItem } from "./NavItem";
import { ConnectedCard } from "./ConnectedCard";
import { SetupCard } from "./SetupCard";

export const SIDEBAR_WIDTH = "270px";

export function Sidebar() {
  const pathname = usePathname();
  const { walletType, isStellarConnected, isEvmConnected, stellarAddress, evmAddress } =
    useWalletType();
  const { disconnect: disconnectEvm } = useDisconnect();
  const { disconnect: disconnectStellar } = useStellarWallet();

  const isConnected = isStellarConnected || isEvmConnected;
  const activeAddress = stellarAddress ?? evmAddress ?? "";

  const handleDisconnect = () => {
    if (walletType === "evm") {
      disconnectEvm();
    } else {
      void disconnectStellar();
    }
  };

  const isActive = (href: string) =>
    href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname === href || pathname?.startsWith(`${href}/`);

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-[270px] flex-col border-r border-white/5 bg-[#121212]">
      <SidebarLogo />

      <nav className="flex flex-1 flex-col gap-1 px-3">
        {NAV_ITEMS.map(({ label, href, icon }) => (
          <NavItem
            key={href}
            label={label}
            href={href}
            icon={icon}
            isActive={isActive(href)}
          />
        ))}
      </nav>

      <div className="p-4">
        {isConnected && activeAddress ? (
          <ConnectedCard address={activeAddress} onDisconnect={handleDisconnect} />
        ) : (
          <SetupCard />
        )}
      </div>
    </aside>
  );
}
