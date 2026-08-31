// @vitest-environment jsdom
/**
 * Tests for wallet-A → wallet-B isolation in useAnchorCustomer (issue #309).
 *
 * The central concern: when a user switches (or another user connects on the
 * same browser) the hook must never return the previous wallet's customerId,
 * bankAccountId, or onboardingUrl.  All three storage slots are now versioned
 * and keyed by walletAddress so each Stellar public key gets its own isolated
 * slot.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const getCustomerMock = vi.hoisted(() => vi.fn());
const createCustomerMock = vi.hoisted(() => vi.fn());

vi.mock("../../utils/rampApi", () => ({
  getCustomer: getCustomerMock,
  createCustomer: createCustomerMock,
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

import { useAnchorCustomer } from "../useAnchorCustomer";
import {
  anchorStorageKey,
  clearAnchorState,
  CUSTOMER_ID_STORAGE_KEY,
  BANK_ACCOUNT_ID_STORAGE_KEY,
  ONBOARDING_URL_STORAGE_KEY,
} from "../../constants/ramp.config";

const WALLET_A = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const WALLET_B = "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  function TestWrapper({ children }: { children: ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
  }
  TestWrapper.displayName = "TestWrapper";
  return TestWrapper;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("useAnchorCustomer — wallet isolation (issue #309)", () => {
  beforeEach(() => {
    localStorage.clear();
    getCustomerMock.mockReset();
    createCustomerMock.mockReset();
  });

  afterEach(() => {
    localStorage.clear();
  });

  // ── Storage key tests ──────────────────────────────────────────────────────

  describe("anchorStorageKey", () => {
    it("produces different keys for different wallet addresses", () => {
      const keyA = anchorStorageKey(CUSTOMER_ID_STORAGE_KEY, WALLET_A);
      const keyB = anchorStorageKey(CUSTOMER_ID_STORAGE_KEY, WALLET_B);
      expect(keyA).not.toEqual(keyB);
    });

    it("embeds the wallet address in the key", () => {
      const key = anchorStorageKey(CUSTOMER_ID_STORAGE_KEY, WALLET_A);
      expect(key).toContain(WALLET_A);
    });

    it("embeds a version number in the key", () => {
      const key = anchorStorageKey(CUSTOMER_ID_STORAGE_KEY, WALLET_A);
      expect(key).toMatch(/_v\d+_/);
    });

    it("does NOT contain any old unscoped key as a prefix match without version", () => {
      // The legacy key is e.g. "neko_anchor_customer_ids".
      // A versioned key must be clearly distinguishable so a naive
      // localStorage.getItem(LEGACY_KEY) cannot accidentally pick up the new one.
      const key = anchorStorageKey(CUSTOMER_ID_STORAGE_KEY, WALLET_A);
      // new key must differ from the plain base key
      expect(key).not.toEqual(CUSTOMER_ID_STORAGE_KEY);
    });
  });

  // ── clearAnchorState tests ─────────────────────────────────────────────────

  describe("clearAnchorState", () => {
    it("removes all three anchor storage slots for the given wallet", () => {
      // Pre-populate all three slots
      for (const base of [
        CUSTOMER_ID_STORAGE_KEY,
        BANK_ACCOUNT_ID_STORAGE_KEY,
        ONBOARDING_URL_STORAGE_KEY,
      ]) {
        localStorage.setItem(
          anchorStorageKey(base, WALLET_A),
          JSON.stringify({ etherfuse: "some-id" })
        );
      }

      clearAnchorState(WALLET_A);

      for (const base of [
        CUSTOMER_ID_STORAGE_KEY,
        BANK_ACCOUNT_ID_STORAGE_KEY,
        ONBOARDING_URL_STORAGE_KEY,
      ]) {
        expect(
          localStorage.getItem(anchorStorageKey(base, WALLET_A))
        ).toBeNull();
      }
    });

    it("does NOT clear slots belonging to a different wallet", () => {
      const keyB = anchorStorageKey(CUSTOMER_ID_STORAGE_KEY, WALLET_B);
      localStorage.setItem(keyB, JSON.stringify({ etherfuse: "wallet-b-id" }));

      clearAnchorState(WALLET_A); // clear A, not B

      expect(localStorage.getItem(keyB)).not.toBeNull();
    });
  });

  // ── Hook initial-state isolation ───────────────────────────────────────────

  describe("hook — initial state isolation", () => {
    it("does not read wallet-A's stored IDs when wallet-B is mounted", () => {
      // Seed wallet-A's data into localStorage as if wallet-A had been used
      localStorage.setItem(
        anchorStorageKey(CUSTOMER_ID_STORAGE_KEY, WALLET_A),
        JSON.stringify({ etherfuse: "cust-wallet-a" })
      );
      localStorage.setItem(
        anchorStorageKey(BANK_ACCOUNT_ID_STORAGE_KEY, WALLET_A),
        JSON.stringify({ etherfuse: "bank-wallet-a" })
      );
      localStorage.setItem(
        anchorStorageKey(ONBOARDING_URL_STORAGE_KEY, WALLET_A),
        JSON.stringify({ etherfuse: "https://kyc-wallet-a" })
      );

      // Mount hook for wallet-B — it must start with null values
      const { result } = renderHook(
        () => useAnchorCustomer("etherfuse", WALLET_B),
        { wrapper: createWrapper() }
      );

      expect(result.current.customerId).toBeNull();
      expect(result.current.bankAccountId).toBeNull();
      expect(result.current.onboardingUrl).toBeNull();
    });

    it("correctly reads wallet-A's own stored IDs when wallet-A is mounted", () => {
      localStorage.setItem(
        anchorStorageKey(CUSTOMER_ID_STORAGE_KEY, WALLET_A),
        JSON.stringify({ etherfuse: "cust-wallet-a" })
      );
      localStorage.setItem(
        anchorStorageKey(BANK_ACCOUNT_ID_STORAGE_KEY, WALLET_A),
        JSON.stringify({ etherfuse: "bank-wallet-a" })
      );

      const { result } = renderHook(
        () => useAnchorCustomer("etherfuse", WALLET_A),
        { wrapper: createWrapper() }
      );

      expect(result.current.customerId).toBe("cust-wallet-a");
      expect(result.current.bankAccountId).toBe("bank-wallet-a");
    });

    it("returns null IDs when no wallet is connected", () => {
      const { result } = renderHook(
        () => useAnchorCustomer("etherfuse", null),
        { wrapper: createWrapper() }
      );
      expect(result.current.customerId).toBeNull();
      expect(result.current.bankAccountId).toBeNull();
      expect(result.current.onboardingUrl).toBeNull();
    });
  });

  // ── ensureCustomer wallet-A then wallet-B ──────────────────────────────────

  describe("ensureCustomer — wallet-A then wallet-B isolation", () => {
    it("wallet-B does NOT get a cache hit on wallet-A's stored identity", async () => {
      // Set up wallet-A's scoped storage as if ensureCustomer had succeeded
      localStorage.setItem(
        anchorStorageKey(CUSTOMER_ID_STORAGE_KEY, WALLET_A),
        JSON.stringify({ etherfuse: "cust-a" })
      );
      localStorage.setItem(
        anchorStorageKey(BANK_ACCOUNT_ID_STORAGE_KEY, WALLET_A),
        JSON.stringify({ etherfuse: "bank-a" })
      );

      // Simulate wallet switch: mount the hook for wallet-B
      getCustomerMock.mockResolvedValue(null); // no existing anchor customer
      createCustomerMock.mockResolvedValue({
        id: "cust-b",
        bankAccountId: "bank-b",
        onboardingUrl: "https://kyc-b",
      });

      const { result } = renderHook(
        () => useAnchorCustomer("etherfuse", WALLET_B),
        { wrapper: createWrapper() }
      );

      // Initial state: no inherited values
      expect(result.current.customerId).toBeNull();

      await act(async () => {
        await result.current.ensureCustomer({
          email: "walletb@example.com",
          publicKey: WALLET_B,
        });
      });

      // After ensureCustomer, wallet-B has its own fresh IDs
      expect(result.current.customerId).toBe("cust-b");
      expect(result.current.bankAccountId).toBe("bank-b");
      expect(result.current.onboardingUrl).toBe("https://kyc-b");

      // wallet-A's scoped storage must be completely untouched
      const storedA = JSON.parse(
        localStorage.getItem(
          anchorStorageKey(CUSTOMER_ID_STORAGE_KEY, WALLET_A)
        ) ?? "{}"
      ) as Record<string, string>;
      expect(storedA.etherfuse).toBe("cust-a");
    });

    it("wallet-A cache hit does not trigger an API call", async () => {
      // Seed wallet-A's storage
      localStorage.setItem(
        anchorStorageKey(CUSTOMER_ID_STORAGE_KEY, WALLET_A),
        JSON.stringify({ etherfuse: "cust-a" })
      );
      localStorage.setItem(
        anchorStorageKey(BANK_ACCOUNT_ID_STORAGE_KEY, WALLET_A),
        JSON.stringify({ etherfuse: "bank-a" })
      );

      const { result } = renderHook(
        () => useAnchorCustomer("etherfuse", WALLET_A),
        { wrapper: createWrapper() }
      );

      await act(async () => {
        await result.current.ensureCustomer({
          email: "walleta@example.com",
          publicKey: WALLET_A,
        });
      });

      // No network calls because cache was valid
      expect(getCustomerMock).not.toHaveBeenCalled();
      expect(createCustomerMock).not.toHaveBeenCalled();
      expect(result.current.customerId).toBe("cust-a");
    });

    it("rejects ensureCustomer when walletAddress is null", async () => {
      const { result } = renderHook(
        () => useAnchorCustomer("etherfuse", null),
        { wrapper: createWrapper() }
      );

      await expect(
        act(async () => {
          await result.current.ensureCustomer({
            email: "no-wallet@example.com",
          });
        })
      ).rejects.toThrow(/No wallet connected/);

      expect(createCustomerMock).not.toHaveBeenCalled();
    });

    it("wallet-B ensureCustomer writes to wallet-B's isolated slot, not wallet-A's", async () => {
      getCustomerMock.mockResolvedValue(null);
      createCustomerMock.mockResolvedValue({
        id: "cust-b",
        bankAccountId: "bank-b",
        onboardingUrl: null,
      });

      const { result } = renderHook(
        () => useAnchorCustomer("etherfuse", WALLET_B),
        { wrapper: createWrapper() }
      );

      await act(async () => {
        await result.current.ensureCustomer({ publicKey: WALLET_B });
      });

      // wallet-B's slot is written
      const storedB = JSON.parse(
        localStorage.getItem(
          anchorStorageKey(CUSTOMER_ID_STORAGE_KEY, WALLET_B)
        ) ?? "{}"
      ) as Record<string, string>;
      expect(storedB.etherfuse).toBe("cust-b");

      // wallet-A's slot does not exist (was never touched)
      expect(
        localStorage.getItem(
          anchorStorageKey(CUSTOMER_ID_STORAGE_KEY, WALLET_A)
        )
      ).toBeNull();
    });
  });

  // ── resetCustomer ──────────────────────────────────────────────────────────

  describe("resetCustomer — only clears current wallet's provider slot", () => {
    it("clears the provider slot for the current wallet without touching other wallets", () => {
      // Seed both wallets
      localStorage.setItem(
        anchorStorageKey(CUSTOMER_ID_STORAGE_KEY, WALLET_A),
        JSON.stringify({ etherfuse: "cust-a" })
      );
      localStorage.setItem(
        anchorStorageKey(CUSTOMER_ID_STORAGE_KEY, WALLET_B),
        JSON.stringify({ etherfuse: "cust-b" })
      );

      const { result } = renderHook(
        () => useAnchorCustomer("etherfuse", WALLET_A),
        { wrapper: createWrapper() }
      );

      act(() => {
        result.current.resetCustomer();
      });

      // Wallet-A's provider slot is removed
      const storedA = JSON.parse(
        localStorage.getItem(
          anchorStorageKey(CUSTOMER_ID_STORAGE_KEY, WALLET_A)
        ) ?? "{}"
      ) as Record<string, string>;
      expect(storedA.etherfuse).toBeUndefined();

      // Wallet-B's slot is untouched
      const storedB = JSON.parse(
        localStorage.getItem(
          anchorStorageKey(CUSTOMER_ID_STORAGE_KEY, WALLET_B)
        ) ?? "{}"
      ) as Record<string, string>;
      expect(storedB.etherfuse).toBe("cust-b");

      // React state is cleared
      expect(result.current.customerId).toBeNull();
      expect(result.current.bankAccountId).toBeNull();
    });
  });

  // ── Legacy (v0) key is never read ─────────────────────────────────────────

  describe("migration: legacy unscoped keys are ignored", () => {
    it("does not read from the old unscoped key even if one exists", () => {
      // Simulate a pre-fix entry written under the legacy key format
      // (key = CUSTOMER_ID_STORAGE_KEY, value = {provider: id})
      localStorage.setItem(
        CUSTOMER_ID_STORAGE_KEY,
        JSON.stringify({ etherfuse: "legacy-cust-id" })
      );

      const { result } = renderHook(
        () => useAnchorCustomer("etherfuse", WALLET_A),
        { wrapper: createWrapper() }
      );

      // The hook must NOT bootstrap from the legacy key
      expect(result.current.customerId).toBeNull();
    });

    it("ensureCustomer does NOT copy the legacy value into the new scoped slot", async () => {
      localStorage.setItem(
        CUSTOMER_ID_STORAGE_KEY,
        JSON.stringify({ etherfuse: "legacy-cust-id" })
      );
      localStorage.setItem(
        BANK_ACCOUNT_ID_STORAGE_KEY,
        JSON.stringify({ etherfuse: "legacy-bank-id" })
      );

      // Anchor has no customer by email → creates a fresh one
      getCustomerMock.mockResolvedValue(null);
      createCustomerMock.mockResolvedValue({
        id: "fresh-cust",
        bankAccountId: "fresh-bank",
        onboardingUrl: null,
      });

      const { result } = renderHook(
        () => useAnchorCustomer("etherfuse", WALLET_A),
        { wrapper: createWrapper() }
      );

      await act(async () => {
        await result.current.ensureCustomer({ publicKey: WALLET_A });
      });

      // The fresh IDs come from the API, not from the legacy key
      expect(result.current.customerId).toBe("fresh-cust");
      expect(createCustomerMock).toHaveBeenCalledTimes(1);
    });
  });
});
