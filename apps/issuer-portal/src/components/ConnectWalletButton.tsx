"use client";

import { useEffect, useRef, useState } from "react";
import { useWallet } from "@/hooks/useWallet";
import { Button } from "@/components/ui/Button";
import { getStellarWalletKit } from "@/lib/helpers/stellar/walletKit";
import storage, { STORAGE_KEYS } from "@/lib/helpers/storage";
import { cn } from "@/lib/cn";

function truncate(addr: string) {
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

export function ConnectWalletButton() {
  const { address } = useWallet();
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const connect = async () => {
    const Kit = await getStellarWalletKit();
    try {
      await Kit.authModal();
      const { address: a } = await Kit.getAddress();
      const { network, networkPassphrase } = await Kit.getNetwork();
      const walletId = Kit.selectedModule?.productId ?? "freighter";
      storage.setItem(STORAGE_KEYS.walletId, walletId);
      storage.setItem(STORAGE_KEYS.walletAddress, a);
      storage.setItem(STORAGE_KEYS.walletNetwork, network);
      storage.setItem(STORAGE_KEYS.networkPassphrase, networkPassphrase);
    } catch (e) {
      console.error("connect failed", e);
    }
  };

  const disconnect = async () => {
    setMenuOpen(false);
    const Kit = await getStellarWalletKit();
    try {
      await Kit.disconnect();
    } catch {
      /* disconnect may be unsupported by some modules */
    }
    storage.setItem(STORAGE_KEYS.walletId, "");
    storage.setItem(STORAGE_KEYS.walletAddress, "");
    storage.setItem(STORAGE_KEYS.walletNetwork, "");
    storage.setItem(STORAGE_KEYS.networkPassphrase, "");
  };

  const copy = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* noop */
    }
  };

  if (!address) {
    return (
      <Button size="sm" onClick={connect}>
        Connect wallet
      </Button>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setMenuOpen((v) => !v)}
      >
        <span>{truncate(address)}</span>
        <span className="text-white/40">▾</span>
      </Button>
      <div
        className={cn(
          "absolute right-0 top-full z-40 mt-2 w-56 overflow-hidden rounded-md border border-white/10 bg-neutral-950 shadow-xl",
          menuOpen ? "block" : "hidden"
        )}
        role="menu"
      >
        <button
          className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm text-white/80 hover:bg-white/5"
          onClick={copy}
          role="menuitem"
        >
          <span>Copy address</span>
          {copied ? (
            <span className="text-[11px] text-neko-teal">Copied</span>
          ) : null}
        </button>
        <button
          className="flex w-full items-center px-3 py-2.5 text-left text-sm text-red-300 hover:bg-red-500/10"
          onClick={disconnect}
          role="menuitem"
        >
          Disconnect
        </button>
      </div>
    </div>
  );
}
