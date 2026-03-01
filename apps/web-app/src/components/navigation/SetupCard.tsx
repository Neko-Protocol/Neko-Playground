"use client";

import React from "react";
import { ArrowRight } from "lucide-react";
import { ConnectWalletModal } from "@/features/wallet/components/ConnectWalletModal";
import { CARD_STYLES, CARD_BUTTON_STYLES } from "./sidebarConfig";

export function SetupCard() {
  const [showModal, setShowModal] = React.useState(false);

  return (
    <>
      <div className={CARD_STYLES}>
        <p className="mb-6 text-base font-bold leading-snug text-black">
          Connect your wallet
          <br />
          to get started!
        </p>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className={CARD_BUTTON_STYLES}
        >
          Connect Account
          <ArrowRight className="h-4 w-4 shrink-0" />
        </button>
      </div>

      <ConnectWalletModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
      />
    </>
  );
}
