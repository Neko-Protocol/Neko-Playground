"use client";

import React from "react";
import { Icon } from "@stellar/design-system";
import { useWallet } from "@/hooks";
import { stellarNetwork } from "@/lib/constants/network";
import { formatNetworkName } from "@/lib/helpers/addressUtils";

const appNetwork = formatNetworkName(stellarNetwork);

const NetworkPill: React.FC = () => {
  const { network, address } = useWallet();

  const walletNetwork = formatNetworkName(network ?? "");
  const isNetworkMismatch = walletNetwork !== appNetwork;

  let title = "";
  let colorVar = "var(--color-wallet-success)";
  if (!address) {
    title = "Connect your wallet using this network.";
    colorVar = "var(--color-wallet-muted)";
  } else if (isNetworkMismatch) {
    title = `Wallet is on ${walletNetwork}, connect to ${appNetwork} instead.`;
    colorVar = "var(--color-wallet-error)";
  }

  return (
    <div
      className="flex items-center gap-1 rounded-2xl px-2.5 py-1 text-xs font-bold cursor-default"
      style={{
        backgroundColor: "var(--color-wallet-neutral-bg)",
        color: "var(--color-wallet-neutral-text)",
        cursor: isNetworkMismatch ? "help" : "default",
      }}
      title={title}
    >
      <Icon.Circle color={colorVar} />
      {appNetwork}
    </div>
  );
};

export default NetworkPill;
