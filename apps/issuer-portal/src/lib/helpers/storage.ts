export const STORAGE_KEYS = {
  walletId: "issuer_portal_walletId",
  walletAddress: "issuer_portal_walletAddress",
  walletNetwork: "issuer_portal_walletNetwork",
  networkPassphrase: "issuer_portal_networkPassphrase",
} as const;

function getStorage(): Storage {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  return {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
    key: () => null,
    length: 0,
  } as Storage;
}

const storage = getStorage();

const api = {
  getItem(
    key: (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS]
  ): string | null {
    return storage.getItem(key);
  },
  setItem(
    key: (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS],
    value: string
  ) {
    storage.setItem(key, value);
  },
};

export default api;
