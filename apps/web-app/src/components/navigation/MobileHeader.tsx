"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, X, ArrowRight, LogOut } from "lucide-react";
import { cn, truncateAddress } from "@/lib/utils";
import { NAV_ITEMS } from "./sidebarConfig";
import { NavItem } from "./NavItem";
import { useWalletType } from "@/hooks/useWalletType";
import { useStellarWallet } from "@/hooks/useStellarWallet";

const NETWORK = (
  process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? "TESTNET"
).toUpperCase();

const IS_TESTNET = NETWORK === "TESTNET";

export function MobileHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const pathname = usePathname();
  const { isStellarConnected, stellarAddress } = useWalletType();
  const { connect, disconnect: disconnectStellar } = useStellarWallet();

  const isConnected = isStellarConnected;
  const activeAddress = stellarAddress ?? "";

  useEffect(() => {
    setMenuOpen(false);
    setWalletOpen(false);
  }, [pathname]);

  const handleDisconnect = () => {
    void disconnectStellar();
    setWalletOpen(false);
    setMenuOpen(false);
  };

  const isActive = (href: string) =>
    href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname === href || pathname?.startsWith(`${href}/`);

  return (
    <>
      <header className="fixed left-0 right-0 top-0 z-50 flex h-16 items-center border-b border-white/5 bg-[#121212] px-4 lg:hidden">
        <Link href="/" className="flex shrink-0 items-center">
          <Image src="/Neko.svg" alt="Neko Logo" width={56} height={56} />
        </Link>

        {/* Wallet button — always centered */}
        <div className="flex flex-1 justify-center px-3">
          {isConnected && activeAddress ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setWalletOpen((v) => !v)}
                className="flex items-center gap-2 rounded-full bg-[#D3D3D3] px-4 py-2.5 text-sm font-semibold text-black"
              >
                <span
                  className={cn(
                    "h-2 w-2 shrink-0 rounded-full",
                    IS_TESTNET ? "bg-yellow-500" : "bg-green-500",
                  )}
                />
                <span>{truncateAddress(activeAddress)}</span>
                <ArrowRight
                  className={cn(
                    "h-4 w-4 shrink-0 transition-transform duration-200",
                    walletOpen && "rotate-90",
                  )}
                />
              </button>

              {walletOpen && (
                <div className="absolute left-1/2 top-full z-50 mt-2 min-w-[164px] -translate-x-1/2 rounded-2xl border border-white/10 bg-[#1e1e1e] px-4 py-3 shadow-xl">
                  <div className="mb-3 flex items-center gap-2">
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full",
                        IS_TESTNET ? "bg-yellow-400" : "bg-green-400",
                      )}
                    />
                    <span className="text-xs font-semibold text-white/50">
                      {IS_TESTNET ? "Testnet" : "Mainnet"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-red-500 transition-colors hover:text-red-400"
                  >
                    <LogOut className="h-4 w-4" />
                    Disconnect
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => void connect()}
              className="flex items-center gap-2 rounded-full bg-[#22C55E] px-5 py-2.5 text-sm font-semibold text-white"
            >
              Connect Wallet
              <ArrowRight className="h-4 w-4 shrink-0" />
            </button>
          )}
        </div>

        {/* Hamburger toggle */}
        <button
          type="button"
          onClick={() => {
            setMenuOpen((v) => !v);
            setWalletOpen(false);
          }}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Toggle menu"
        >
          {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </header>

      {/* Slide-down nav menu — max-height transition for smooth reveal */}
      <div
        className="fixed inset-x-0 top-16 z-40 overflow-hidden lg:hidden"
        style={{
          maxHeight: menuOpen ? "400px" : "0px",
          opacity: menuOpen ? 1 : 0,
          pointerEvents: menuOpen ? "auto" : "none",
          transition:
            "max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease",
        }}
      >
        <nav className="border-b border-white/5 bg-[#121212] px-3 py-2 shadow-2xl">
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
      </div>

      {/* Backdrop — always in DOM for smooth fade */}
      <div
        className="fixed inset-0 top-16 z-30 lg:hidden"
        style={{
          backgroundColor: "rgba(0,0,0,0.5)",
          opacity: menuOpen ? 1 : 0,
          pointerEvents: menuOpen ? "auto" : "none",
          transition: "opacity 0.3s ease",
        }}
        onClick={() => setMenuOpen(false)}
      />
    </>
  );
}
