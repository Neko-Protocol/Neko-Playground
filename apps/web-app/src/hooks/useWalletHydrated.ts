"use client";

import { useEffect, useState } from "react";
import { useStellarWalletStore } from "@/stores/stellarWalletStore";

export function useWalletHydrated(): boolean {
  const [hydrated, setHydrated] = useState(
    () => useStellarWalletStore.persist.hasHydrated()
  );

  useEffect(() => {
    if (useStellarWalletStore.persist.hasHydrated()) {
      setHydrated(true);
      return;
    }

    return useStellarWalletStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });
  }, []);

  return hydrated;
}
