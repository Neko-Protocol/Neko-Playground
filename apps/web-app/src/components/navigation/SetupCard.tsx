"use client";

import React from "react";
import { ArrowRight } from "lucide-react";
import { useStellarWallet } from "@/hooks/useStellarWallet";
import { CARD_STYLES, CARD_BUTTON_STYLES } from "./sidebarConfig";

export function SetupCard() {
  const { connect } = useStellarWallet();

  return (
    <div className={CARD_STYLES}>
      <p className="mb-6 text-base font-bold leading-snug text-black">
        Connect your wallet
        <br />
        to get started!
      </p>
      <button
        type="button"
        onClick={() => void connect()}
        className={CARD_BUTTON_STYLES}
      >
        Connect Account
        <ArrowRight className="h-4 w-4 shrink-0" />
      </button>
    </div>
  );
}
