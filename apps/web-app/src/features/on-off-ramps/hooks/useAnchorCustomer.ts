"use client";

import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  createCustomer,
  getCustomer,
  isAuthRequiredError,
  RampApiError,
} from "../utils/rampApi";
import type { AnchorProvider } from "@/lib/anchors/types";
import {
  CUSTOMER_ID_STORAGE_KEY,
  BANK_ACCOUNT_ID_STORAGE_KEY,
  ONBOARDING_URL_STORAGE_KEY,
} from "../constants/ramp.config";

function getStoredId(key: string, provider: AnchorProvider): string | null {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    const map = JSON.parse(stored) as Record<string, string>;
    return map[provider] || null;
  } catch {
    return null;
  }
}

function storeId(key: string, provider: AnchorProvider, id: string) {
  try {
    const stored = localStorage.getItem(key);
    const map = stored ? (JSON.parse(stored) as Record<string, string>) : {};
    map[provider] = id;
    localStorage.setItem(key, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function useAnchorCustomer(provider: AnchorProvider) {
  const [customerId, setCustomerId] = useState<string | null>(() =>
    getStoredId(CUSTOMER_ID_STORAGE_KEY, provider)
  );
  const [bankAccountId, setBankAccountId] = useState<string | null>(() =>
    getStoredId(BANK_ACCOUNT_ID_STORAGE_KEY, provider)
  );
  const [onboardingUrl, setOnboardingUrl] = useState<string | null>(() =>
    getStoredId(ONBOARDING_URL_STORAGE_KEY, provider)
  );
  const [authRequired, setAuthRequired] = useState(false);

  const { mutateAsync: ensureCustomer, isPending } = useMutation({
    mutationFn: async ({ email }: { email?: string; publicKey?: string }) => {
      setAuthRequired(false);

      const storedCustomerId = getStoredId(CUSTOMER_ID_STORAGE_KEY, provider);
      const storedBankAccountId = getStoredId(
        BANK_ACCOUNT_ID_STORAGE_KEY,
        provider
      );
      const storedOnboardingUrl = getStoredId(
        ONBOARDING_URL_STORAGE_KEY,
        provider
      );

      if (storedCustomerId) {
        try {
          const existing = await getCustomer(provider, {
            customerId: storedCustomerId,
          });
          if (existing) {
            if (existing.bankAccountId) {
              storeId(
                BANK_ACCOUNT_ID_STORAGE_KEY,
                provider,
                existing.bankAccountId
              );
            }
            return {
              customerId: existing.id,
              bankAccountId: existing.bankAccountId ?? storedBankAccountId,
              onboardingUrl: storedOnboardingUrl,
            };
          }
        } catch (error) {
          if (isAuthRequiredError(error)) {
            setAuthRequired(true);
            throw error;
          }
          if (
            error instanceof RampApiError &&
            (error.status === 403 || error.status === 404)
          ) {
            // Stale or unbound customer — create a new one below.
          } else {
            throw error;
          }
        }
      }

      const customer = await createCustomer(provider, {
        email,
        country: "MX",
      });
      storeId(CUSTOMER_ID_STORAGE_KEY, provider, customer.id);
      if (customer.bankAccountId) {
        storeId(BANK_ACCOUNT_ID_STORAGE_KEY, provider, customer.bankAccountId);
      }
      if (customer.onboardingUrl) {
        storeId(ONBOARDING_URL_STORAGE_KEY, provider, customer.onboardingUrl);
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
      setAuthRequired(false);
    },
    onError: (error) => {
      if (isAuthRequiredError(error)) {
        setAuthRequired(true);
      }
    },
  });

  const resetCustomer = useCallback(() => {
    try {
      for (const key of [
        CUSTOMER_ID_STORAGE_KEY,
        BANK_ACCOUNT_ID_STORAGE_KEY,
        ONBOARDING_URL_STORAGE_KEY,
      ]) {
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
    setCustomerId(null);
    setBankAccountId(null);
    setOnboardingUrl(null);
    setAuthRequired(false);
  }, [provider]);

  return {
    customerId,
    bankAccountId,
    onboardingUrl,
    ensureCustomer,
    isPending,
    authRequired,
    resetCustomer,
  };
}
