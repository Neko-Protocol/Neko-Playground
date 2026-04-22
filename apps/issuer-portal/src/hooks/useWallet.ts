"use client";

import { useContext } from "react";
import { WalletContext } from "@/providers/WalletProvider";

export function useWallet() {
  return useContext(WalletContext);
}
