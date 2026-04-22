"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ListedAsset } from "@/types";

interface PortalState {
  assets: ListedAsset[];
  addAsset: (a: ListedAsset) => void;
}

export const usePortalStore = create<PortalState>()(
  persist(
    (set) => ({
      assets: [],
      addAsset: (a) =>
        set((s) => ({
          assets: [...s.assets.filter((x) => x.contractId !== a.contractId), a],
        })),
    }),
    { name: "issuer-portal-assets" }
  )
);
