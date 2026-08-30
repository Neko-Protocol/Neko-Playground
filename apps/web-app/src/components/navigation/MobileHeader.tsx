"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { X, Menu, LogOut, ChevronDown, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./sidebarConfig";
import { useWalletType } from "@/hooks/useWalletType";
import { useStellarWallet } from "@/hooks/useStellarWallet";
import { truncateAddress } from "@/lib/utils";
import { useActivityFeed } from "@/features/activity/hooks/useActivityFeed";
import { clientEnv } from "@/lib/env.client";

const IS_TESTNET = clientEnv.stellarNetwork === "TESTNET";
const ADMIN_ADDRESS = clientEnv.lendingAdminAddress;

export function MobileHeader() {
  const [isOpen, setIsOpen] = useState(false);
  const [walletDropdownOpen, setWalletDropdownOpen] = useState(false);
  const pathname = usePathname();
  const { isStellarConnected, stellarAddress } = useWalletType();
  const { connect, disconnect } = useStellarWallet();
  const { unreadCount } = useActivityFeed();
  const menuRef = useRef<HTMLDivElement>(null);
  const walletButtonRef = useRef<HTMLDivElement>(null);

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

  const isActive = (href: string) =>
    href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname === href || pathname?.startsWith(`${href}/`);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current && !menuRef.current.contains(target)) {
        setIsOpen(false);
      }
      if (
        walletButtonRef.current &&
        !walletButtonRef.current.contains(target)
      ) {
        setWalletDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, walletDropdownOpen]);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <>
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 flex flex-col border-b border-white/5 bg-[#121212] pt-6">
        <div className="flex h-14 min-h-14 justify-between items-center pr-1.5 sm:px-4">
          <div className="min-w-0 items-center justify-start">
            <Link
              href="/"
              className="flex shrink-0 items-start justify-start bg-blue-500"
              aria-label="Neko home"
            >
              <Image
                src="/Neko.svg"
                alt=""
                width={36}
                height={36}
                className="h-7 w-auto"
              />
            </Link>
          </div>

          <div className="relative min-w-0 mr-6" ref={walletButtonRef}>
            {isConnected && activeAddress ? (
              <>
                <button
                  type="button"
                  onClick={() => setWalletDropdownOpen((v) => !v)}
                  className="flex max-w-full items-center justify-center gap-1.5 rounded-full bg-[#229EDF] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[#1a8bc7] transition-colors sm:min-w-[100px] sm:gap-2 sm:px-3"
                >
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-yellow-400"
                    aria-hidden
                  />
                  <span className="truncate">
                    {truncateAddress(activeAddress)}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-80 sm:h-4 sm:w-4" />
                </button>
                {walletDropdownOpen && (
                  <div
                    className="absolute left-1/2 top-full z-50 mt-1.5 w-max -translate-x-1/2 rounded-lg border border-white/10 bg-[#1C1C1C] px-3 py-2 shadow-xl"
                    role="menu"
                  >
                    <div className="flex items-center gap-3 whitespace-nowrap text-xs">
                      <span className="font-medium text-white/50">
                        {IS_TESTNET ? "Testnet" : "Mainnet"}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          void disconnect();
                          setWalletDropdownOpen(false);
                        }}
                        className="flex items-center gap-1.5 font-medium text-red-400 hover:text-red-300 transition-colors"
                        role="menuitem"
                      >
                        <LogOut className="h-3.5 w-3.5 shrink-0" />
                        Disconnect
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <button
                type="button"
                onClick={() => void connect()}
                className="whitespace-nowrap rounded-full self-center bg-[#229EDF] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1a8bc7] transition-colors sm:px-4 sm:py-2 sm:text-sm"
              >
                Connect Wallet
              </button>
            )}
          </div>

          <div className="min-w-0 justify-end flex items-center gap-1 sm:gap-2">
            <Link
              href="/activity"
              className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white transition-colors hover:bg-white/10 sm:h-12 sm:w-12"
            >
              <Bell className="h-5 w-5 sm:h-6 sm:w-6" />
              {unreadCount > 0 && (
                <span className="absolute top-2 right-2 flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-blue-500 text-[9px] font-bold text-white border-2 border-[#121212]">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>

            <button
              type="button"
              onClick={() => setIsOpen((v) => !v)}
              aria-label="Toggle menu"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white transition-colors hover:bg-white/10 sm:h-12 sm:w-12"
            >
              {isOpen ? (
                <X className="h-6 w-6 sm:h-7 sm:w-7" />
              ) : (
                <Menu className="h-6 w-6 sm:h-7 sm:w-7" />
              )}
            </button>
          </div>
        </div>
      </header>

      <div
        className={cn(
          "lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ease-out",
          isOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        )}
        aria-hidden="true"
      />

      <div
        ref={menuRef}
        className={cn(
          "lg:hidden fixed left-0 right-0 top-20 z-50 bg-[#121212] border-b border-white/5 overflow-hidden",
          "transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
          isOpen
            ? "translate-y-0 opacity-100"
            : "-translate-y-2 opacity-0 pointer-events-none"
        )}
      >
        <div className="flex flex-col gap-2 px-4 py-6 sm:px-6">
          {navItems.map(({ label, href, icon }) => {
            const Icon = icon;
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex w-full items-center justify-start gap-4 rounded-2xl px-4 py-4 text-lg font-medium transition-colors duration-150 sm:px-6",
                  active ? "text-white" : "text-white/35 hover:text-white/65"
                )}
                style={
                  active
                    ? { background: "#222222", borderRadius: "24px" }
                    : { borderRadius: "24px" }
                }
              >
                <Icon
                  className={cn(
                    "h-6 w-6 shrink-0",
                    active ? "text-white" : "text-white/35"
                  )}
                />
                <div className="flex items-center justify-between w-full">
                  <span>{label}</span>
                  {label === "Activity" && unreadCount > 0 && (
                    <span className="flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-blue-500 text-[10px] font-bold text-white">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
