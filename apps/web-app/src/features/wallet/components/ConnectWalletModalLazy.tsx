"use client";

import dynamic from "next/dynamic";
import type { ConnectWalletModalProps } from "./ConnectWalletModal";

/**
 * Code-split wrapper around ConnectWalletModal.
 *
 * The modal pulls in the wallet-kit connection flow, which no visitor needs
 * until they actually open it. `ssr: false` keeps it out of the initial
 * bundle and out of server rendering (it's client-only and returns null
 * while closed anyway). Import this instead of ConnectWalletModal directly.
 */
export const ConnectWalletModal = dynamic<ConnectWalletModalProps>(
  () => import("./ConnectWalletModal").then((m) => m.ConnectWalletModal),
  { ssr: false }
);
