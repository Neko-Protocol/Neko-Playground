/**
 * Default Stellar env for Vitest — mirrors apps/web-app/.env.example (TESTNET).
 * Required because modules such as contractsByNetwork resolve at import time.
 */
process.env.NEXT_PUBLIC_STELLAR_NETWORK = "TESTNET";
process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE =
  "Test SDF Network ; September 2015";
process.env.NEXT_PUBLIC_STELLAR_RPC_URL = "https://soroban-testnet.stellar.org";
process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL =
  "https://horizon-testnet.stellar.org";

const localStorageStore: Record<string, string> = {};

const localStorageMock = {
  getItem: (key: string) => localStorageStore[key] ?? null,
  setItem: (key: string, value: string) => {
    localStorageStore[key] = value;
  },
  removeItem: (key: string) => {
    delete localStorageStore[key];
  },
  clear: () => {
    for (const key of Object.keys(localStorageStore)) {
      delete localStorageStore[key];
    }
  },
};

Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true,
});
