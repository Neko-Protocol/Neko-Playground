"use client";

import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { createCustomer, getCustomer } from "../utils/rampApi";
import type { AnchorProvider } from "@/lib/anchors/types";
import {
  CUSTOMER_ID_STORAGE_KEY,
  BANK_ACCOUNT_ID_STORAGE_KEY,
  ONBOARDING_URL_STORAGE_KEY,
  anchorStorageKey,
} from "../constants/ramp.config";

// ─── Storage helpers ──────────────────────────────────────────────────────────
//
// Each entry is a JSON map: Record<AnchorProvider, string>.
// The localStorage key is versioned and wallet-scoped so different Stellar
// addresses never share anchor identity.  Format:
//   neko_anchor_<field>_v<version>_<walletAddress>

function getStoredId(
  baseKey: string,
  provider: AnchorProvider,
  walletAddress: string
): string | null {
  try {
    const stored = localStorage.getItem(
      anchorStorageKey(baseKey, walletAddress)
    );
    if (!stored) return null;
    const map = JSON.parse(stored) as Record<string, string>;
    return map[provider] ?? null;
  } catch {
    return null;
  }
}

function storeId(
  baseKey: string,
  provider: AnchorProvider,
  walletAddress: string,
  id: string
) {
  try {
    const key = anchorStorageKey(baseKey, walletAddress);
    const stored = localStorage.getItem(key);
    const map = stored ? (JSON.parse(stored) as Record<string, string>) : {};
    map[provider] = id;
    localStorage.setItem(key, JSON.stringify(map));
  } catch {
    // ignore
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAnchorCustomer(
  provider: AnchorProvider,
  /** The currently-connected Stellar public key.  Pass null/undefined when no
   *  wallet is connected — all reads will return null and writes are skipped. */
  walletAddress: string | null | undefined
) {
  const [customerId, setCustomerId] = useState<string | null>(() => {
    if (!walletAddress) return null;
    return getStoredId(CUSTOMER_ID_STORAGE_KEY, provider, walletAddress);
  });
  const [bankAccountId, setBankAccountId] = useState<string | null>(() => {
    if (!walletAddress) return null;
    return getStoredId(BANK_ACCOUNT_ID_STORAGE_KEY, provider, walletAddress);
  });
  const [onboardingUrl, setOnboardingUrl] = useState<string | null>(() => {
    if (!walletAddress) return null;
    return getStoredId(ONBOARDING_URL_STORAGE_KEY, provider, walletAddress);
  });

  const { mutateAsync: ensureCustomer, isPending } = useMutation({
    mutationFn: async ({
      email,
      publicKey,
    }: {
      email?: string;
      publicKey?: string;
    }) => {
      // Guard: cannot create/look up a customer without a wallet address.
      // This keeps the cache scoped correctly and avoids writing to a
      // provider-only key that a future wallet might accidentally inherit.
      if (!walletAddress) {
        throw new Error("No wallet connected — cannot ensure anchor customer");
      }

      // Return stored IDs if already present for this wallet + provider pair.
      const storedCustomerId = getStoredId(
        CUSTOMER_ID_STORAGE_KEY,
        provider,
        walletAddress
      );
      const storedBankAccountId = getStoredId(
        BANK_ACCOUNT_ID_STORAGE_KEY,
        provider,
        walletAddress
      );
      const storedOnboardingUrl = getStoredId(
        ONBOARDING_URL_STORAGE_KEY,
        provider,
        walletAddress
      );
      if (storedCustomerId && storedBankAccountId) {
        return {
          customerId: storedCustomerId,
          bankAccountId: storedBankAccountId,
          onboardingUrl: storedOnboardingUrl,
        };
      }

      // Try to find existing customer by email at the anchor.
      if (email) {
        const existing = await getCustomer(provider, { email });
        if (existing) {
          storeId(
            CUSTOMER_ID_STORAGE_KEY,
            provider,
            walletAddress,
            existing.id
          );
          if (existing.bankAccountId) {
            storeId(
              BANK_ACCOUNT_ID_STORAGE_KEY,
              provider,
              walletAddress,
              existing.bankAccountId
            );
          }
          return {
            customerId: existing.id,
            bankAccountId: existing.bankAccountId,
            onboardingUrl: null,
          };
        }
      }

      // Create new customer at the anchor.
      const customer = await createCustomer(provider, {
        email,
        publicKey,
        country: "MX",
      });
      storeId(CUSTOMER_ID_STORAGE_KEY, provider, walletAddress, customer.id);
      if (customer.bankAccountId) {
        storeId(
          BANK_ACCOUNT_ID_STORAGE_KEY,
          provider,
          walletAddress,
          customer.bankAccountId
        );
      }
      // Store the onboarding URL from initial registration — it cannot
      // be re-fetched later (Etherfuse returns 409 for existing users).
      if (customer.onboardingUrl) {
        storeId(
          ONBOARDING_URL_STORAGE_KEY,
          provider,
          walletAddress,
          customer.onboardingUrl
        );
      }
      return {
        customerId: customer.id,
        bankAccountId: customer.bankAccountId,
        onboardingUrl: customer.onboardingUrl ?? null,
      };
    },
    onSuccess: ({
      customerId: cid,
      bankAccountId: bid,
      onboardingUrl: url,
    }) => {
      setCustomerId(cid);
      if (bid) setBankAccountId(bid);
      if (url) setOnboardingUrl(url);
    },
  });

  const resetCustomer = useCallback(() => {
    if (walletAddress) {
      try {
        for (const baseKey of [
          CUSTOMER_ID_STORAGE_KEY,
          BANK_ACCOUNT_ID_STORAGE_KEY,
          ONBOARDING_URL_STORAGE_KEY,
        ]) {
          const key = anchorStorageKey(baseKey, walletAddress);
          const stored = localStorage.getItem(key);
          if (stored) {
            const map = JSON.parse(stored) as Record<string, string>;
            delete map[provider];
            localStorage.setItem(key, JSON.stringify(map));
          }
        }
      } catch {
        // ignore
      }
    }
    setCustomerId(null);
    setBankAccountId(null);
    setOnboardingUrl(null);
  }, [provider, walletAddress]);

  return {
    customerId,
    bankAccountId,
    onboardingUrl,
    ensureCustomer,
    isPending,
    resetCustomer,
  };
}
