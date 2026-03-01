"use client";

import React from "react";
import { ArrowRight, LogOut } from "lucide-react";
import { truncateAddress } from "@/lib/utils";
import { CARD_STYLES, CARD_BUTTON_STYLES } from "./sidebarConfig";

const NETWORK = (
  process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? "TESTNET"
).toUpperCase();

const IS_TESTNET = NETWORK === "TESTNET";

interface ConnectedCardProps {
  address: string;
  onDisconnect: () => void;
}

export function ConnectedCard({ address, onDisconnect }: ConnectedCardProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className={CARD_STYLES}>
      <p className="mb-4 text-base font-bold leading-snug text-black">
        You&apos;re
        <br />
        connect with:
      </p>

      {/* Address pill — click to reveal options */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={CARD_BUTTON_STYLES}
      >
        <span className="truncate">{truncateAddress(address)}</span>
        <ArrowRight
          className={`ml-2 h-4 w-4 shrink-0 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
        />
      </button>

      {/* Expandable panel — always in DOM, animated via max-height + opacity */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          open ? "max-h-40 opacity-100 mt-2" : "max-h-0 opacity-0 mt-0"
        }`}
      >
        <div className="flex flex-col gap-2 rounded-2xl bg-black/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${IS_TESTNET ? "bg-yellow-400" : "bg-green-400"}`}
            />
            <span className="text-xs font-semibold text-black/60">
              {IS_TESTNET ? "Testnet" : "Mainnet"}
            </span>
          </div>

          <button
            type="button"
            onClick={onDisconnect}
            className="flex items-center gap-2 text-sm font-semibold text-red-600 hover:text-red-700 transition-colors cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            Disconnect
          </button>
        </div>
      </div>
    </div>
  );
}
